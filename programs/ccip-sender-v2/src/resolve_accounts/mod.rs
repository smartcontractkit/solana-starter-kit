#![allow(clippy::doc_overindented_list_items, clippy::doc_lazy_continuation)]
//! Account resolution for this program's `ccip_send`.
//!
//! A program that wraps `ccip_send_v2` cannot expect its callers to hand-build an account list: the
//! router's own list is produced by its multi-stage resolver and changes shape with the message
//! (token transfers, CCVs, executor, pool lookup tables). So this program implements the same
//! resolution interface (`ccip_common::resolution`) and, for the part of the list that belongs to
//! the router, simply drives the router's resolver over CPI - prepending the accounts of its own
//! that `ccip_send` reads, and forwarding everything else verbatim.
//!
//! That means a change to the router's account layout still needs no change here, exactly as with
//! the send itself.
//!
//! Stage flow
//! ─────────
//! Stages are marked with `★`; `↺` marks a stage that may repeat.
//!
//! ★ start (no CPI)
//!   │   emits: this program's named accounts, then its transfer-token block (when the message
//!   │          carries a transfer) - i.e. every account `ccip_send` reads for itself
//!   │
//!   ▼
//! ★ forward_router_stage ── CPI ⟶ the router stage the previous round named, starting with the
//!   │                          router's own `resolve_accounts_start`
//!   │                          emits: that stage's accounts, verbatim
//!   └──↺ (repeats until the router stops asking for another round)
//!
//! The start stage runs no router stage of its own: a round's whole response has to fit in Solana's
//! 1kB return data, and this program's accounts plus a full page of the router's do not.
//!
//! Interface notes
//! ───────────────
//! - Resolution is driven exactly like any other program's: call `resolve_accounts_start` with
//!   `ResolveAccountsParams { caller, ix_data, metadata: [] }`, then follow
//!   `next_ix_discriminator`, accumulating `accounts_to_save` and `lookup_tables_to_save`. The
//!   final round's `metadata` is `CcipSendParams::resolution_metadata`.
//! - `ix_data` is a `ccip_send` instruction payload with `resolution_metadata` empty (it is what
//!   resolution produces) and `max_fee` set to anything (it does not affect the account list).
//! - `caller` is the account that will sign `ccip_send`, i.e. the user whose tokens are pulled -
//!   *not* the `ccip_sender` PDA. This program substitutes its own PDA when it resolves the router,
//!   the way any wrapping program has to.
//! - [`ResolveAccountsStart`] takes more than the interface's single config account. In order, the
//!   extra accounts are `chain_config`, `fee_token_mint`, `router`, `router_config`, and - only when
//!   the message carries a token transfer - the transferred token's mint as a remaining account.
//! - The first account is this program's `state` PDA (seeds `[b"state"]`), which plays the role the
//!   interface calls "config".

mod common;
mod forward;
mod start;

pub use common::*;
pub use forward::*;
pub use start::*;

use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use ccip_common::resolution::*;

use crate::error::SenderError;
use crate::instruction as sender_instruction;
use crate::state::{BaseState, RemoteChainConfig, STATE_SEED};

/// Accounts for the shared resolution entrypoint.
///
/// `state` is the config account the interface asks every program to expose first; the rest are
/// what this program's resolver needs to read or CPI into, and are documented on the module.
#[derive(Accounts)]
pub struct ResolveAccountsStart<'info> {
    #[account(
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    /// The destination chain's config, source of the recipient and extra args `ccip_send` puts in
    /// the message. Its PDA is checked in the handler, once the selector has been parsed out of
    /// `params.ix_data`.
    pub chain_config: Account<'info, RemoteChainConfig>,
    /// CHECK: the fee token mint - wrapped SOL when paying in native SOL - read only for the token
    /// program that owns it, which the caller's fee ATA is derived with. Checked against the
    /// message's fee token in the handler.
    pub fee_token_mint: UncheckedAccount<'info>,
    /// CHECK: the router this program sends through; checked against `state.router`.
    pub router: UncheckedAccount<'info>,
    /// CHECK: the router's config PDA, the single account its own resolution entrypoint takes.
    /// Checked by derivation.
    pub router_config: UncheckedAccount<'info>,
}

/// Routes the shared entrypoint to the resolver for the instruction named in `params.ix_data`.
///
/// `ccip_send` is the only instruction here whose accounts are worth resolving; the rest are
/// admin instructions with fixed, derivable lists.
pub fn resolve_accounts_start<'info>(
    ctx: Context<'info, ResolveAccountsStart<'info>>,
    params: ResolveAccountsParams,
) -> Result<ResolveAccountsResponse> {
    let (ix_discriminator, _data) = validate_resolution_start(&params, true)?;

    match ix_discriminator {
        sender_instruction::CcipSend::DISCRIMINATOR => start(ctx, params),
        _ => {
            msg!(
                "Unknown discriminator to resolve accounts for: {}",
                BytesWrapper(ix_discriminator)
            );
            Err(SenderError::InvalidResolutionInstructionData.into())
        }
    }
}
