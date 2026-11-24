use anchor_lang::prelude::*;
use ccip_common::ccvs::{GetReceiverCcvsIn, GetReceiverCcvsOut};

use crate::state::{SourceChainCcvConfig, CCV_CONFIG_SEED};

/// Solana analog of EVM `IAny2EVMMessageReceiverV2.getCCVsAndFinalityConfig`. Returns this
/// receiver's required/optional CCVs, optional threshold, and allowed finality config for a source
/// chain. The OffRamp queries this via CPI and reads the response from return data (see
/// `ccip-common::ccvs::get_receiver_ccvs_cpi`, invoked from the OffRamp's `resolve_receiver_ccvs`).
///
/// If no config exists for the source chain (PDA uninitialized), returns an empty response, which
/// the OffRamp interprets as "use the lane default CCVs" with full finality (`WAIT_FOR_FINALITY`).
pub fn get_ccvs_and_finality_config(
    ctx: Context<GetCcvsAndFinalityConfig>,
    _input: GetReceiverCcvsIn,
) -> Result<GetReceiverCcvsOut> {
    let Some(cfg) = SourceChainCcvConfig::try_load(&ctx.accounts.source_chain_ccv_config)? else {
        return Ok(GetReceiverCcvsOut::default());
    };

    Ok(GetReceiverCcvsOut {
        required_ccvs: cfg.required_ccvs,
        optional_ccvs: cfg.optional_ccvs,
        optional_threshold: cfg.optional_threshold,
        allowed_finality_config: cfg.allowed_finality_config,
    })
}

#[derive(Accounts)]
#[instruction(input: GetReceiverCcvsIn)]
pub struct GetCcvsAndFinalityConfig<'info> {
    /// CHECK: per-source-chain CCV config PDA. May be uninitialized (see `try_load`); validated by
    /// seeds only. Derivable from `input.source_chain_selector`, so the OffRamp can supply it.
    /// This is the only account the query needs — it is keyed solely by source chain.
    #[account(
        seeds = [CCV_CONFIG_SEED, input.source_chain_selector.to_le_bytes().as_ref()],
        bump,
    )]
    pub source_chain_ccv_config: UncheckedAccount<'info>,
}
