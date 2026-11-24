use anchor_lang::prelude::*;
use ccip_common::messages::FinalityConfig;

/// Emitted by `ccip_receive_v2` when a message is delivered. Carries the source chain and sender
/// (in addition to the message id) so indexers can attribute the delivery without re-fetching the
/// message — the EVM receiver interface likewise hands the full message context to the callback.
#[event]
pub struct MessageReceived {
    pub message_id: [u8; 32],
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
}

/// Emitted when the CCV/finality configuration for a source chain is set or updated.
/// Mirrors EVM `CCIPClientExampleWithCCVs.CCVConfigSet`.
#[event]
pub struct CcvConfigSet {
    pub source_chain_selector: u64,
    pub required_ccvs: Vec<Pubkey>,
    pub optional_ccvs: Vec<Pubkey>,
    pub optional_threshold: u8,
    pub allowed_finality_config: FinalityConfig,
}

/// Emitted when the CCV/finality configuration for a source chain is removed.
#[event]
pub struct CcvConfigRemoved {
    pub source_chain_selector: u64,
}
