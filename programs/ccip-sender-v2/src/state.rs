use anchor_lang::prelude::*;

use crate::error::SenderError;

/// Seed of the program's singleton config PDA, [`BaseState`].
pub const STATE_SEED: &[u8] = b"state";
/// Seed of a destination chain's [`RemoteChainConfig`] PDA, together with its chain selector.
pub const CHAIN_CONFIG_SEED: &[u8] = b"remote_chain_config";
/// Seed of the PDA that signs the CPI into the router and custodies the tokens it pulls.
pub const CCIP_SENDER: &[u8] = b"ccip_sender";

/// Current schema version of [`BaseState`], for forward-compatible migrations.
pub const BASE_STATE_V: u8 = 1;
/// Current schema version of [`RemoteChainConfig`].
pub const REMOTE_CHAIN_CONFIG_V: u8 = 1;

#[account]
#[derive(InitSpace, Default, Debug)]
pub struct BaseState {
    pub version: u8,
    pub bump: u8,
    /// Bump of the `[b"ccip_sender"]` PDA, which signs the CPI into the router and custodies the
    /// tokens being transferred. Stored here so `ccip_send` can `invoke_signed` without declaring
    /// that PDA as one of its own accounts.
    pub ccip_sender_bump: u8,

    pub owner: Pubkey,
    pub proposed_owner: Pubkey,

    pub router: Pubkey,
}

impl BaseState {
    pub fn new(owner: Pubkey, router: Pubkey, bump: u8, ccip_sender_bump: u8) -> Result<Self> {
        require_keys_neq!(router, Pubkey::default(), SenderError::InvalidRouter);
        Ok(Self {
            version: BASE_STATE_V,
            bump,
            ccip_sender_bump,
            owner,
            proposed_owner: Pubkey::default(),
            router,
        })
    }

    pub fn transfer_ownership(&mut self, owner: Pubkey, proposed_owner: Pubkey) -> Result<()> {
        require_keys_neq!(
            proposed_owner,
            self.owner,
            SenderError::InvalidProposedOwner
        );
        require_keys_neq!(
            proposed_owner,
            Pubkey::default(),
            SenderError::InvalidProposedOwner
        );
        require_keys_eq!(self.owner, owner, SenderError::OnlyOwner);
        self.proposed_owner = proposed_owner;
        Ok(())
    }

    pub fn accept_ownership(&mut self, proposed_owner: Pubkey) -> Result<()> {
        require_keys_eq!(
            self.proposed_owner,
            proposed_owner,
            SenderError::OnlyProposedOwner
        );
        self.proposed_owner = Pubkey::default();
        self.owner = proposed_owner;
        Ok(())
    }

    pub fn update_router(&mut self, owner: Pubkey, router: Pubkey) -> Result<()> {
        require_keys_neq!(router, Pubkey::default(), SenderError::InvalidRouter);
        require_keys_eq!(self.owner, owner, SenderError::OnlyOwner);
        self.router = router;
        Ok(())
    }
}

#[account]
#[derive(InitSpace, Default, Debug)]
pub struct RemoteChainConfig {
    pub version: u8,
    pub bump: u8,
    #[max_len(64)]
    pub recipient: Vec<u8>, // the address to send messages to on the destination chain
    // Used to calculate InitSpace; the account is sized with the actual byte count at init.
    #[max_len(0)]
    // The tag-prefixed extra args applied to every outgoing message for this chain. For the v2
    // onramp this is a `GenericExtraArgsV3` blob (tag 0xa69dd4aa): gas limit, finality, the CCV
    // list and args, the executor, and the token receiver/args.
    pub extra_args_bytes: Vec<u8>,
}

impl RemoteChainConfig {
    /// As with [`BaseState::new`], the handler writes the result with `set_inner`.
    pub fn new(bump: u8, recipient: Vec<u8>, extra_args_bytes: Vec<u8>) -> Self {
        Self {
            version: REMOTE_CHAIN_CONFIG_V,
            bump,
            recipient,
            extra_args_bytes,
        }
    }
}

/// Emitted after the router accepted the message.
///
/// `fee_amount` is what the router actually billed, not the `max_fee` the caller allowed.
#[event]
pub struct MessageSent {
    pub dest_chain_selector: u64,
    pub fee_token: Pubkey,
    pub fee_amount: u64,
    pub message_id: [u8; 32],
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_state() -> BaseState {
        BaseState {
            owner: Pubkey::new_unique(),
            ..BaseState::default()
        }
    }

    #[test]
    fn ownership() {
        let mut state = create_state();
        let next_owner = Pubkey::new_unique();

        // only owner can propose
        assert_eq!(
            state
                .transfer_ownership(Pubkey::new_unique(), Pubkey::new_unique())
                .unwrap_err(),
            SenderError::OnlyOwner.into()
        );
        state.transfer_ownership(state.owner, next_owner).unwrap();

        // only proposed_owner can accept
        assert_eq!(
            state.accept_ownership(Pubkey::new_unique()).unwrap_err(),
            SenderError::OnlyProposedOwner.into(),
        );
        state.accept_ownership(next_owner).unwrap();
    }

    #[test]
    fn router() {
        let mut state = create_state();

        assert_eq!(
            state
                .update_router(state.owner, Pubkey::default())
                .unwrap_err(),
            SenderError::InvalidRouter.into(),
        );
        assert_eq!(
            state
                .update_router(Pubkey::new_unique(), Pubkey::new_unique())
                .unwrap_err(),
            SenderError::OnlyOwner.into(),
        );
        state
            .update_router(state.owner, Pubkey::new_unique())
            .unwrap();
    }

    #[test]
    fn new_persists_version_and_bumps() {
        let owner = Pubkey::new_unique();
        let router = Pubkey::new_unique();

        let state = BaseState::new(owner, router, 253, 251).unwrap();

        assert_eq!(state.version, BASE_STATE_V);
        assert_eq!(state.bump, 253);
        assert_eq!(state.ccip_sender_bump, 251);
        assert_eq!(state.owner, owner);
        assert_eq!(state.router, router);

        assert_eq!(
            BaseState::new(owner, Pubkey::default(), 253, 251).unwrap_err(),
            SenderError::InvalidRouter.into(),
        );
    }
}
