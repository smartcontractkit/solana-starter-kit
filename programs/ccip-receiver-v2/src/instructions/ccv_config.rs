use anchor_lang::prelude::*;
use ccip_common::messages::FinalityConfig;

use crate::error::CcipReceiverError;
use crate::event::{CcvConfigRemoved, CcvConfigSet};
use crate::state::{
    Config, SourceChainCcvConfig, CCV_CONFIG_SEED, CONFIG_SEED, MAX_CCVS, SOURCE_CHAIN_CCV_CONFIG_V,
};
use crate::ANCHOR_DISCRIMINATOR;

/// Arguments for [`set_ccv_config`]. Bundled into a single struct (INV-LINT-PARAMS) and to mirror
/// the token pool's `SetCcvConfigParams`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SetCcvConfigParams {
    // PDA dimensions
    pub source_chain_selector: u64,

    pub required_ccvs: Vec<Pubkey>,
    pub optional_ccvs: Vec<Pubkey>,
    pub optional_threshold: u8,
    pub allowed_finality_config: FinalityConfig,
}

/// Sets (or updates) the CCV + finality requirements for messages from a source chain.
pub fn set_ccv_config(ctx: Context<SetCcvConfig>, params: SetCcvConfigParams) -> Result<()> {
    validate_ccv_config(
        &params.required_ccvs,
        &params.optional_ccvs,
        params.optional_threshold,
    )?;

    ctx.accounts
        .source_chain_ccv_config
        .set_inner(SourceChainCcvConfig {
            version: SOURCE_CHAIN_CCV_CONFIG_V,
            bump: ctx.bumps.source_chain_ccv_config,
            required_ccvs: params.required_ccvs.clone(),
            optional_ccvs: params.optional_ccvs.clone(),
            optional_threshold: params.optional_threshold,
            allowed_finality_config: params.allowed_finality_config,
        });

    emit_cpi!(CcvConfigSet {
        source_chain_selector: params.source_chain_selector,
        required_ccvs: params.required_ccvs,
        optional_ccvs: params.optional_ccvs,
        optional_threshold: params.optional_threshold,
        allowed_finality_config: params.allowed_finality_config,
    });
    Ok(())
}

/// Removes the CCV config for a source chain, reverting it to the lane defaults + full finality.
pub fn remove_ccv_config(ctx: Context<RemoveCcvConfig>, source_chain_selector: u64) -> Result<()> {
    // Removal itself is declarative (`close = authority` on the config account); we still emit an
    // event for observability. `ctx` is consumed by `emit_cpi!` (event authority + program).
    emit_cpi!(CcvConfigRemoved {
        source_chain_selector,
    });
    Ok(())
}

/// Validation mirrors EVM `CCIPClientExampleWithCCVs.applyCCVConfigUpdates` and the OffRamp's CCV
/// rules: bounded lengths, no zero pubkey as optional (it is the "use defaults" marker, valid only
/// as a required entry), no duplicates within or across the two sets, and a sane optional threshold.
pub(crate) fn validate_ccv_config(
    required_ccvs: &[Pubkey],
    optional_ccvs: &[Pubkey],
    optional_threshold: u8,
) -> Result<()> {
    require_gte!(
        MAX_CCVS,
        required_ccvs.len(),
        CcipReceiverError::TooManyCCVs
    );
    require_gte!(
        MAX_CCVS,
        optional_ccvs.len(),
        CcipReceiverError::TooManyCCVs
    );

    for ccv in optional_ccvs {
        require_keys_neq!(
            *ccv,
            Pubkey::default(),
            CcipReceiverError::ZeroPubkeyNotAllowedAsOptional
        );
    }

    let mut seen =
        std::collections::HashSet::with_capacity(required_ccvs.len() + optional_ccvs.len());
    for ccv in required_ccvs.iter().chain(optional_ccvs.iter()) {
        // `insert` returns false when `ccv` was already present, i.e. a duplicate.
        require!(seen.insert(*ccv), CcipReceiverError::DuplicateCCV);
    }

    // A threshold >= optional length is unsatisfiable / means "all optional are really required".
    if optional_ccvs.is_empty() {
        require_eq!(
            optional_threshold,
            0,
            CcipReceiverError::InvalidOptionalThreshold
        );
    } else {
        require_gt!(
            optional_ccvs.len(),
            optional_threshold as usize,
            CcipReceiverError::InvalidOptionalThreshold
        );
    }

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(params: SetCcvConfigParams)]
pub struct SetCcvConfig<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init_if_needed,
        seeds = [CCV_CONFIG_SEED, params.source_chain_selector.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + SourceChainCcvConfig::INIT_SPACE,
    )]
    pub source_chain_ccv_config: Account<'info, SourceChainCcvConfig>,
    #[account(mut, address = config.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(source_chain_selector: u64)]
pub struct RemoveCcvConfig<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        close = authority,
        seeds = [CCV_CONFIG_SEED, source_chain_selector.to_le_bytes().as_ref()],
        bump,
    )]
    pub source_chain_ccv_config: Account<'info, SourceChainCcvConfig>,
    #[account(mut, address = config.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pk(seed: u8) -> Pubkey {
        let mut bytes = [0u8; 32];
        bytes[0] = seed;
        Pubkey::from(bytes)
    }

    #[test]
    fn empty_config_is_valid() {
        // Empty means "use lane defaults"; must be accepted.
        validate_ccv_config(&[], &[], 0).unwrap();
    }

    #[test]
    fn required_may_contain_zero_marker() {
        // Pubkey::default() is the "also include lane defaults" marker, valid in required.
        validate_ccv_config(&[Pubkey::default(), pk(1)], &[], 0).unwrap();
    }

    #[test]
    fn optional_with_valid_threshold_ok() {
        validate_ccv_config(&[pk(1)], &[pk(2), pk(3)], 1).unwrap();
    }

    #[test]
    fn zero_in_optional_rejected() {
        let err = validate_ccv_config(&[], &[Pubkey::default()], 0).unwrap_err();
        assert_eq!(
            err,
            CcipReceiverError::ZeroPubkeyNotAllowedAsOptional.into()
        );
    }

    #[test]
    fn duplicate_within_required_rejected() {
        let err = validate_ccv_config(&[pk(1), pk(1)], &[], 0).unwrap_err();
        assert_eq!(err, CcipReceiverError::DuplicateCCV.into());
    }

    #[test]
    fn duplicate_across_sets_rejected() {
        let err = validate_ccv_config(&[pk(1)], &[pk(1)], 0).unwrap_err();
        assert_eq!(err, CcipReceiverError::DuplicateCCV.into());
    }

    #[test]
    fn threshold_ge_optional_len_rejected() {
        // threshold == len is unsatisfiable-as-optional (they'd be required).
        let err = validate_ccv_config(&[], &[pk(2), pk(3)], 2).unwrap_err();
        assert_eq!(err, CcipReceiverError::InvalidOptionalThreshold.into());
    }

    #[test]
    fn nonzero_threshold_without_optional_rejected() {
        let err = validate_ccv_config(&[pk(1)], &[], 1).unwrap_err();
        assert_eq!(err, CcipReceiverError::InvalidOptionalThreshold.into());
    }

    #[test]
    fn too_many_ccvs_rejected() {
        let too_many: Vec<Pubkey> = (0..=MAX_CCVS as u16).map(|i| pk(i as u8)).collect();
        let err = validate_ccv_config(&too_many, &[], 0).unwrap_err();
        assert_eq!(err, CcipReceiverError::TooManyCCVs.into());
    }
}
