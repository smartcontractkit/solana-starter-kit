use anchor_lang::prelude::*;

use ccip_common::resolution::{ResolveAccountsParams, ResolveAccountsResponse};

pub mod error;
pub mod instructions;
pub mod resolve_accounts;
pub mod state;
pub mod tokens;

use instructions::*;
use resolve_accounts::*;

declare_id!("7zGbs3PZSrZryQqJFpcYZf8kJ8BbxavmBngcLmYy9ds5");

pub const ANCHOR_DISCRIMINATOR: usize = 8;

/// An example CCIP 2.0 Sender Program,
///
/// This file contains no logic, only the entrypoints into `instructions/`. Adding an
/// instruction means adding a module there and an entrypoint here.
#[program]
pub mod ccip_sender_v2 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
        instructions::initialize::initialize(ctx, router)
    }

    /// Sends a CCIP 2.0 message, paying for it out of the caller's tokens.
    ///
    /// # Accounts
    ///
    /// Resolve them with [`resolve_accounts`], which produces the whole list.
    ///
    /// # Fees
    ///
    /// The caller states an upper bound (`params.max_fee`) rather than having this program quote the
    /// message onchain: `get_fee_v2` repeats most of `ccip_send_v2`'s work, and paying for it twice
    /// inside a CPI leaves very little of the compute budget for the send itself. Quote offchain,
    /// add slippage, and pass the result. Whatever the router does not bill is returned to the
    /// caller before this instruction ends, and the amount actually billed is reported in
    /// [`MessageSent`](crate::state::MessageSent).
    pub fn ccip_send<'info>(
        ctx: Context<'info, CcipSend<'info>>,
        params: CcipSendParams,
    ) -> Result<()> {
        instructions::ccip_send::ccip_send(ctx, params)
    }

    /// Entrypoint to resolve the accounts `ccip_send` needs. See [`resolve_accounts`] for the flow and for
    /// the accounts this stage itself takes.
    pub fn resolve_accounts_start<'info>(
        ctx: Context<'info, ResolveAccountsStart<'info>>,
        params: ResolveAccountsParams,
    ) -> Result<ResolveAccountsResponse> {
        resolve_accounts::resolve_accounts_start(ctx, params)
    }

    /// Continues resolution by running the router's next `ccip_send_v2` stage.
    pub fn resolve_accounts_forward_router_stage<'info>(
        ctx: Context<'info, ResolveAccountsForwardRouterStage<'info>>,
        params: ResolveAccountsParams,
    ) -> Result<ResolveAccountsResponse> {
        resolve_accounts::forward_router_stage(ctx, params)
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

    /// Creates this program's associated token account for `mint`, idempotently.
    pub fn init_ccip_sender_ata(ctx: Context<InitCcipSenderAta>) -> Result<()> {
        instructions::admin::init_ccip_sender_ata(ctx)
    }

    pub fn withdraw_tokens(
        ctx: Context<WithdrawTokens>,
        params: WithdrawTokensParams,
    ) -> Result<()> {
        instructions::admin::withdraw_tokens(ctx, params)
    }

    /// Creates the config for a destination chain. Its existence is what allows sends to that
    /// chain; `remove_chain_config` closes it again.
    pub fn init_chain_config(
        ctx: Context<InitChainConfig>,
        params: ChainConfigParams,
    ) -> Result<()> {
        instructions::chain_config::init_chain_config(ctx, params)
    }

    /// Updates a destination chain's config. Separate from `init_chain_config` because changing
    /// the extra args needs a realloc.
    pub fn update_chain_config(
        ctx: Context<UpdateChainConfig>,
        params: ChainConfigParams,
    ) -> Result<()> {
        instructions::chain_config::update_chain_config(ctx, params)
    }

    /// Disables a destination chain by closing its config account. Reversible via
    /// `init_chain_config`.
    pub fn remove_chain_config(ctx: Context<RemoveChainConfig>, chain_selector: u64) -> Result<()> {
        instructions::chain_config::remove_chain_config(ctx, chain_selector)
    }
}
