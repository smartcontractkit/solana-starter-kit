use anchor_lang::prelude::*;
pub use ccip_common::messages::{SVMTokenAmount, SVMTokenReceiverUsage};

/// The single (optional) token transfer carried by a v2 `Any2SVMMessage`.
///
/// A v2 message carries at most one token transfer. Beyond the amount, this exposes WHERE the
/// OffRamp delivered the tokens so the receiver can verify who was credited on a (programmatic)
/// token transfer — it mirrors the OffRamp's own `token_receiver` / `token_receiver_usage` inputs
/// (see `ccip_common::v2::validate_and_parse_offramp_token_accounts_v2`).
#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct TokenTransfer {
    pub token_amount: SVMTokenAmount,
    /// The account the OffRamp credited, interpreted per `token_receiver_usage`: with `UseAsIs` it
    /// is the token account directly; otherwise it is the wallet the ATA is derived from (with
    /// mint = `token_amount.token`).
    pub token_receiver: Pubkey,
    pub token_receiver_usage: SVMTokenReceiverUsage,
}

/// Message delivered to this receiver via the `ccip_receive_v2` CPI.
///
/// WIRE-FORMAT CONTRACT: the OffRamp must serialize a byte-identical struct when it CPIs
/// `ccip_receive_v2`. Note this deliberately carries the token transfer as `Option<TokenTransfer>`
/// (a v2 message carries at most one token transfer), which is NOT Borsh-compatible with the
/// OffRamp's legacy v1 `Any2SVMMessage` (`token_amounts: Vec<SVMTokenAmount>` — `Option` is a 1-byte
/// tag, `Vec` a 4-byte length prefix). This type is currently copied here rather than shared.
///
/// The OffRamp serializes a matching struct (`ccip-offramp`'s `Any2SVMMessageV2`) when it CPIs
/// `ccip_receive_v2`.
#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct Any2SVMMessage {
    pub message_id: [u8; 32],
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
    pub data: Vec<u8>,
    // A v2 message carries at most one token transfer, so this is an `Option` rather than a `Vec`.
    // Carries the token receiver + usage so the receiver can verify who the tokens were sent to.
    pub token_transfer: Option<TokenTransfer>,
}
