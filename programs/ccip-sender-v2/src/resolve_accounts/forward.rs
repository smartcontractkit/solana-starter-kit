use anchor_lang::prelude::*;
use ccip_common::resolution::*;

use crate::state::{RemoteChainConfig, CCIP_SENDER};

use super::common::*;

/// Accounts for every round after [`super::start`].
///
/// The two named accounts are this program's fixed cost of wrapping the router: `chain_config` to
/// rebuild the message the router resolves against, and `router` to CPI into. Everything after them
/// is the router's own `ask_again_with` for its next stage, forwarded untouched.
///
/// Neither is checked against `state` here, and it does not need to be: resolution is a read-only
/// simulation whose only product is a list the caller then feeds back to `ccip_send`, which pins
/// the router against `state.router` and the authority slot against its own PDA. Re-reading `state`
/// every round would cost a third `ask_again_with` slot out of a budget the router is already
/// spending (see [`wrap_router_response`]).
#[derive(Accounts)]
pub struct ResolveAccountsForwardRouterStage<'info> {
    pub chain_config: Account<'info, RemoteChainConfig>,
    /// CHECK: the router whose resolution stage this round runs; it is the caller's own account
    /// list that a wrong one would spoil.
    pub router: UncheckedAccount<'info>,
}

/// Runs the router's next `ccip_send_v2` resolution stage and republishes its response.
///
/// This stage points back at itself for as long as the router has stages left, so a caller must
/// keep following `next_ix_discriminator` rather than assuming a fixed number of rounds: the router
/// pages large token lookup tables and repeats its nested stages once per pool and per CCV.
pub fn forward_router_stage<'info>(
    ctx: Context<'info, ResolveAccountsForwardRouterStage<'info>>,
    params: ResolveAccountsParams,
) -> Result<ResolveAccountsResponse> {
    let send_params = parse_send_params(&params.ix_data)?;
    let metadata = deserialize_metadata::<SenderResolutionMetadata>(&params.metadata)?;

    require_chain_config(
        ctx.accounts.chain_config.key(),
        send_params.dest_chain_selector,
    )?;

    let ccip_sender = find(&[CCIP_SENDER], crate::ID);

    let router_response = invoke_router_resolver(
        &ctx.accounts.router.to_account_info(),
        ctx.remaining_accounts,
        metadata.router_ix_discriminator,
        ResolveAccountsParams {
            caller: ccip_sender,
            ix_data: router_send_ix_data(&send_params, &ctx.accounts.chain_config),
            metadata: metadata.router_metadata,
        },
    )?;

    // No prefix: this program's own accounts were all emitted by the start stage.
    wrap_router_response(
        vec![],
        ctx.accounts.chain_config.key(),
        ctx.accounts.router.key(),
        ccip_sender,
        router_response,
    )
}
