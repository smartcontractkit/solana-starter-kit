use anchor_lang::prelude::*;

use crate::error::CcipReceiverError;
use crate::event::MessageReceived;
use crate::message::Any2SVMMessage;
use crate::state::{
    ApprovedSender, Config, ALLOWED_OFFRAMP_SEED, APPROVED_SENDER_SEED, CONFIG_SEED,
    EXTERNAL_EXECUTION_CONFIG_SEED,
};

/// Called by the CCIP OffRamp to deliver a v2 message.
///
/// The method name is `ccip_receive_v2`, so its Anchor discriminator differs from the v1
/// `ccip_receive` — the OffRamp dispatches to it based on the receiver's stored interface version.
/// The account layout matches the v1 example receiver, but the `Any2SVMMessage` payload does NOT:
/// v2 carries the token transfer as `Option<TokenTransfer>` instead of v1's `token_amounts: Vec<...>`
/// (see `message.rs`), which is not Borsh-compatible with v1.
///
/// The OffRamp dispatches here for v2 receivers (see `ccip-offramp` `call_receiver`); the v1-vs-v2
/// selection is driven by the router-owned `ReceiverRegistry`, which this program opts into via
/// `register_with_router`.
pub fn ccip_receive_v2(ctx: Context<CcipReceiveV2>, message: Any2SVMMessage) -> Result<()> {
    // ---------------------------------------
    // implement functionality here
    // ---------------------------------------

    // NOTE: `emit_cpi!` (required by INV-LINT-EVENT once a program uses `#[event_cpi]`) emits via a
    // self-CPI, so it adds a nested CPI plus two accounts (`event_authority`, `program`) to this
    // instruction — costs paid on every delivery, on top of the OffRamp → receiver CPI. Acceptable
    // for reliable indexing; the OffRamp must supply those two accounts when invoking this.
    emit_cpi!(MessageReceived {
        message_id: message.message_id,
        source_chain_selector: message.source_chain_selector,
        sender: message.sender,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts, Debug)]
#[instruction(message: Any2SVMMessage)]
pub struct CcipReceiveV2<'info> {
    // OffRamp CPI signer PDA must be first. Derived under the OffRamp program from this receiver's
    // program id, so a valid signature here proves the call originated from that OffRamp.
    #[account(
        seeds = [EXTERNAL_EXECUTION_CONFIG_SEED, crate::ID.as_ref()],
        bump,
        seeds::program = offramp_program.key(),
    )]
    pub authority: Signer<'info>,

    /// CHECK: offramp program, used only to derive the allowed_offramp PDA and the authority PDA.
    /// Must be second.
    pub offramp_program: UncheckedAccount<'info>,

    /// CHECK: PDA of the router program proving `offramp_program` is an allowed offramp for this
    /// source chain. Owned by the configured router iff it exists (i.e. the offramp is allowed).
    /// Must be third.
    #[account(
        owner = config.router @ CcipReceiverError::InvalidCaller,
        seeds = [
            ALLOWED_OFFRAMP_SEED,
            message.source_chain_selector.to_le_bytes().as_ref(),
            offramp_program.key().as_ref()
        ],
        bump,
        seeds::program = config.router,
    )]
    pub allowed_offramp: UncheckedAccount<'info>,

    // Receiver-specific PDAs.
    // If this PDA does not exist, the (source chain, sender) pair is not approved and delivery fails.
    #[account(
        seeds = [
            APPROVED_SENDER_SEED,
            message.source_chain_selector.to_le_bytes().as_ref(),
            &message.sender,
        ],
        bump,
    )]
    pub approved_sender: Account<'info, ApprovedSender>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    // NOTE: the `#[event_cpi]` attribute above appends two more accounts to this instruction —
    // `event_authority` (a PDA of this program) and `program` (this program) — which `emit_cpi!`
    // uses to emit the event via a self-CPI. This is receiver-specific: the CCIP protocol does not
    // require receivers to emit an event, so the OffRamp must supply these two trailing accounts
    // only because THIS receiver chooses to. A receiver that doesn't emit events can drop both
    // `#[event_cpi]` and these accounts.
}
