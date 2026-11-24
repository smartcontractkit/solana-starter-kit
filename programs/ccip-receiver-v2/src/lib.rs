use anchor_lang::prelude::*;
use ccip_common::ccvs::{GetReceiverCcvsIn, GetReceiverCcvsOut};

pub mod error;
pub mod event;
pub mod instructions;
pub mod message;
pub mod state;

use instructions::*;
use message::Any2SVMMessage;

declare_id!("BpR2B1WNYgssZwDQEDm23EoFQqJVuCrGg59uFB4afjq2");

pub const ANCHOR_DISCRIMINATOR: usize = 8;

/// This program is an example of a CCIP v2 Receiver Program, intended as starter code for v2
/// customers. It keeps the example receiver's behavior (ownership, router, sender approval, token
/// withdrawal, and a `MessageReceived` event) under the renamed `ccip_receive_v2` entrypoint, and
/// adds the CCIP v2 receiver interface: `get_ccvs_and_finality_config`, backed by per-source-chain
/// CCV/finality configuration.
#[program]
pub mod ccip_receiver_v2 {
    use super::*;

    /// Initialization is the responsibility of the external user; CCIP does not initialize
    /// receiver accounts.
    pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
        instructions::initialize::initialize(ctx, router)
    }

    /// Called by the CCIP OffRamp to execute a v2 CCIP message. The method name is
    /// `ccip_receive_v2` (distinct discriminator from v1 `ccip_receive`), so the OffRamp dispatches
    /// to it based on the receiver's stored interface version.
    pub fn ccip_receive_v2(ctx: Context<CcipReceiveV2>, message: Any2SVMMessage) -> Result<()> {
        instructions::ccip_receive_v2::ccip_receive_v2(ctx, message)
    }

    /// Registers this program as a CCIP v2 receiver in the router. Callable only by
    /// the program's upgrade authority; CPIs the router's `register_receiver`, signing with this
    /// program's registration PDA. The OffRamp then reads that registry to route messages through
    /// the v2 receiver flow.
    pub fn register_with_router(ctx: Context<RegisterWithRouter>) -> Result<()> {
        instructions::register::register_with_router(ctx)
    }

    pub fn update_router(ctx: Context<UpdateConfig>, new_router: Pubkey) -> Result<()> {
        instructions::admin::update_router(ctx, new_router)
    }

    pub fn transfer_ownership(ctx: Context<UpdateConfig>, proposed_owner: Pubkey) -> Result<()> {
        instructions::admin::transfer_ownership(ctx, proposed_owner)
    }

    pub fn accept_ownership(ctx: Context<AcceptOwnership>) -> Result<()> {
        instructions::admin::accept_ownership(ctx)
    }

    /// Creates a PDA approving a (source chain, remote sender) pair to deliver messages.
    pub fn approve_sender(ctx: Context<ApproveSender>, params: SenderParams) -> Result<()> {
        instructions::admin::approve_sender(ctx, params)
    }

    pub fn unapprove_sender(ctx: Context<UnapproveSender>, params: SenderParams) -> Result<()> {
        instructions::admin::unapprove_sender(ctx, params)
    }

    pub fn withdraw_tokens(
        ctx: Context<WithdrawTokens>,
        params: WithdrawTokensParams,
    ) -> Result<()> {
        instructions::admin::withdraw_tokens(ctx, params)
    }

    /// Sets (or updates) the CCV + finality requirements for messages from a source chain.
    pub fn set_ccv_config(ctx: Context<SetCcvConfig>, params: SetCcvConfigParams) -> Result<()> {
        instructions::ccv_config::set_ccv_config(ctx, params)
    }

    /// Removes the CCV config for a source chain, reverting it to the lane defaults + full finality.
    pub fn remove_ccv_config(
        ctx: Context<RemoveCcvConfig>,
        source_chain_selector: u64,
    ) -> Result<()> {
        instructions::ccv_config::remove_ccv_config(ctx, source_chain_selector)
    }

    /// CCIP v2 receiver interface: returns the required/optional CCVs, optional threshold, and
    /// allowed finality config for a source chain. Solana analog of EVM
    /// `IAny2EVMMessageReceiverV2.getCCVsAndFinalityConfig`.
    pub fn get_ccvs_and_finality_config(
        ctx: Context<GetCcvsAndFinalityConfig>,
        input: GetReceiverCcvsIn,
    ) -> Result<GetReceiverCcvsOut> {
        instructions::get_ccvs::get_ccvs_and_finality_config(ctx, input)
    }
}
