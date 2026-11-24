use anchor_lang::prelude::*;
use ccip_common::messages::FinalityConfig;

use crate::error::CcipReceiverError;

// PDA seed constants (equivalent to V1). NOTE: the seed *values* match V1, but the
// `approved_ccip_sender` seed *list* does not — V1 additionally includes a `[sender.len() as u8]`
// seed, so V1 and V2 derive different approval PDAs for the same (chain, sender) pair.
pub const EXTERNAL_EXECUTION_CONFIG_SEED: &[u8] = b"external_execution_config";
pub const APPROVED_SENDER_SEED: &[u8] = b"approved_ccip_sender";
pub const TOKEN_ADMIN_SEED: &[u8] = b"receiver_token_admin";
pub const ALLOWED_OFFRAMP_SEED: &[u8] = b"allowed_offramp";
pub const CONFIG_SEED: &[u8] = b"config";

/// Maximum supported length, in bytes, of a remote (cross-chain) sender address.
///
/// The sender bytes are used directly as a PDA seed in the `approved_ccip_sender` derivation, and
/// Solana caps each *individual* seed at [`MAX_SEED_LEN`] (32) bytes — the cap is per seed, not
/// per seed list. Addresses longer than this cannot be expressed in this scheme: derivation aborts
/// with `MaxSeedLengthExceeded`. Every source chain CCIP supports today fits (EVM 20, SVM 32,
/// Aptos/Sui 32). Supporting longer addresses would mean seeding on a fixed-size digest of the
/// sender instead, which changes the address of every existing approval PDA and would therefore
/// need a deliberate migration with a re-approval path.
pub const MAX_SENDER_ADDRESS_LEN: usize = anchor_lang::solana_program::pubkey::MAX_SEED_LEN;

/// PDA seed for the per-source-chain CCV/finality config (CCIP v2 addition). Sourced from
/// `ccip-common` so the OffRamp (which derives this same PDA to query the receiver) can't drift.
pub const CCV_CONFIG_SEED: &[u8] = ccip_common::ccvs::RECEIVER_CCV_CONFIG_SEED;

/// Maximum number of CCVs storable in each of the required / optional lists of a
/// [`SourceChainCcvConfig`]. Fixed (rather than realloc-on-write) to keep the account a fixed size.
pub const MAX_CCVS: usize = 16;

/// Current schema version of [`SourceChainCcvConfig`], for forward-compatible migrations.
pub const SOURCE_CHAIN_CCV_CONFIG_V: u8 = 1;

/// Current schema version of [`Config`], for forward-compatible migrations.
pub const CONFIG_V: u8 = 1;

/// Config contains the Config for core safety checks that can be leveraged by the implementer.
#[account]
#[derive(InitSpace, Default, Debug)]
pub struct Config {
    pub version: u8,
    pub bump: u8,
    pub owner: Pubkey,
    pub proposed_owner: Pubkey,

    pub router: Pubkey,
}

impl Config {
    pub fn init(&mut self, owner: Pubkey, router: Pubkey) -> Result<()> {
        require_keys_eq!(self.owner, Pubkey::default());
        self.owner = owner;
        self.update_router(owner, router)
    }

    pub fn transfer_ownership(&mut self, owner: Pubkey, proposed_owner: Pubkey) -> Result<()> {
        require_keys_neq!(
            proposed_owner,
            self.owner,
            CcipReceiverError::InvalidProposedOwner
        );
        require_keys_neq!(
            proposed_owner,
            Pubkey::default(),
            CcipReceiverError::InvalidProposedOwner
        );
        require_keys_eq!(self.owner, owner, CcipReceiverError::OnlyOwner);
        self.proposed_owner = proposed_owner;
        Ok(())
    }

    pub fn accept_ownership(&mut self, proposed_owner: Pubkey) -> Result<()> {
        require_keys_eq!(
            self.proposed_owner,
            proposed_owner,
            CcipReceiverError::OnlyProposedOwner
        );
        // NOTE: take() resets proposed_owner to default
        self.owner = std::mem::take(&mut self.proposed_owner);
        Ok(())
    }

    pub fn update_router(&mut self, owner: Pubkey, router: Pubkey) -> Result<()> {
        require_keys_neq!(router, Pubkey::default(), CcipReceiverError::InvalidRouter);
        require_keys_eq!(self.owner, owner, CcipReceiverError::OnlyOwner);
        self.router = router;
        Ok(())
    }
}

/// Marker PDA proving a (source chain, remote sender) pair is approved. Approval is conveyed by the
/// account's mere existence — like the router's `AllowedOfframp` marker, it stores no data and is
/// validated purely by its PDA derivation plus program ownership (enforced by `Account<_>`).
#[account]
#[derive(InitSpace, Default, Debug)]
pub struct ApprovedSender {}

/// Per-source-chain CCV + finality requirements, queried by the OffRamp via
/// `get_ccvs_and_finality_config` (CCIP v2). Derivable purely from `source_chain_selector`, so
/// account resolution for the query CPI is trivial. May be absent (uninitialized) — in which case
/// the receiver falls back to the lane default CCVs and full finality.
#[account]
#[derive(InitSpace, Debug)]
pub struct SourceChainCcvConfig {
    pub version: u8,
    pub bump: u8,
    #[max_len(MAX_CCVS)]
    pub required_ccvs: Vec<Pubkey>,
    #[max_len(MAX_CCVS)]
    pub optional_ccvs: Vec<Pubkey>,
    pub optional_threshold: u8,
    pub allowed_finality_config: FinalityConfig,
}

impl SourceChainCcvConfig {
    /// Loads the config from a possibly-uninitialized account. Returns `None` when the account is
    /// not owned by this program (i.e. never initialized). Errors on an unrecognized stored
    /// `version` rather than silently treating it as "no config" — a newer, richer config must not
    /// be under-read into the lane-defaults fallback. Callers must have validated the PDA via
    /// Anchor seeds.
    pub fn try_load(account_info: &AccountInfo) -> Result<Option<Self>> {
        if *account_info.owner != crate::ID {
            return Ok(None);
        }
        let data = account_info.try_borrow_data()?;
        let config = Self::try_deserialize(&mut &data[..])?;
        require_eq!(
            config.version,
            SOURCE_CHAIN_CCV_CONFIG_V,
            CcipReceiverError::UnsupportedConfigVersion
        );
        Ok(Some(config))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_config() -> Config {
        Config {
            owner: Pubkey::new_unique(),
            ..Config::default()
        }
    }

    #[test]
    fn ownership() {
        let mut config = create_config();
        let next_owner = Pubkey::new_unique();

        // only owner can propose
        assert_eq!(
            config
                .transfer_ownership(Pubkey::new_unique(), Pubkey::new_unique())
                .unwrap_err(),
            CcipReceiverError::OnlyOwner.into()
        );
        config.transfer_ownership(config.owner, next_owner).unwrap();

        // only proposed_owner can accept
        assert_eq!(
            config.accept_ownership(Pubkey::new_unique()).unwrap_err(),
            CcipReceiverError::OnlyProposedOwner.into(),
        );
        config.accept_ownership(next_owner).unwrap();
    }

    #[test]
    fn router() {
        let mut config = create_config();

        assert_eq!(
            config
                .update_router(config.owner, Pubkey::default())
                .unwrap_err(),
            CcipReceiverError::InvalidRouter.into(),
        );
        assert_eq!(
            config
                .update_router(Pubkey::new_unique(), Pubkey::new_unique())
                .unwrap_err(),
            CcipReceiverError::OnlyOwner.into(),
        );
        config
            .update_router(config.owner, Pubkey::new_unique())
            .unwrap();
    }
}
