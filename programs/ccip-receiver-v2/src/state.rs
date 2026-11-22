use anchor_lang::prelude::*;

// PDA seeds. `state` / `messages_storage` intentionally match ccip-basic-receiver so the
// EVM -> Solana scripts derive the same receiver accounts for either program.
pub const STATE_SEED: &[u8] = b"state";
pub const MESSAGES_STORAGE_SEED: &[u8] = b"messages_storage";

// Seeds shared with the CCIP 2.0 OffRamp / Router (ccip_common::seed in chainlink-ccip-solana).
pub const EXTERNAL_EXECUTION_CONFIG_SEED: &[u8] = b"external_execution_config";
pub const ALLOWED_OFFRAMP_SEED: &[u8] = b"allowed_offramp";
pub const CCV_CONFIG_SEED: &[u8] = b"ccv_config";
pub const RECEIVER_REGISTRY_SEED: &[u8] = b"receiver_registry";
pub const RECEIVER_REGISTRATION_SIGNER_SEED: &[u8] = b"ccip_receiver_registration";

pub const ANCHOR_DISCRIMINATOR: usize = 8;
pub const MAX_MESSAGE_DATA_SIZE: usize = 1024;
pub const MAX_SENDER_ADDRESS_SIZE: usize = 64;
pub const MAX_CCVS: usize = 16;
pub const SOURCE_CHAIN_CCV_CONFIG_V: u8 = 1;

/// Mirrors `ccip_common::messages::FinalityConfig`.
///
/// As an *allowed* config: a requested finality is accepted if it is WAIT_FOR_FINALITY, if its
/// flag is one of `flags`, or if `block_depth != 0` and the requested depth >= `block_depth`.
/// Flag 0x0001 = `safe` (EVM finality value 0x00010000).
#[derive(Clone, Copy, InitSpace, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Default)]
pub struct FinalityConfig {
    pub flags: u16,
    pub block_depth: u16,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct BaseState {
    pub owner: Pubkey,
    pub router: Pubkey,
    pub bump: u8,
}

/// Per-source-chain CCV + finality requirements returned to the OffRamp by
/// `get_ccvs_and_finality_config`. Absent => lane default CCVs + full finality.
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

/// Mirrors `ccip_common::messages::SVMTokenAmount`.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Debug, Default, PartialEq, Eq)]
pub struct SVMTokenAmount {
    pub token: Pubkey,
    pub amount: u64,
}

/// Mirrors `ccip_common::messages::SVMTokenReceiverUsage`.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Copy, Clone, Debug, PartialEq, Eq)]
pub enum SVMTokenReceiverUsage {
    DeriveAtaAndCreate,
    DeriveAtaDontCreate,
    UseAsIs,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Debug)]
pub struct TokenTransfer {
    pub token_amount: SVMTokenAmount,
    /// Account credited by the OffRamp (token account if UseAsIs, otherwise the ATA owner).
    pub token_receiver: Pubkey,
    pub token_receiver_usage: SVMTokenReceiverUsage,
}

/// Message delivered by the CCIP 2.0 OffRamp via `ccip_receive_v2`.
/// WIRE FORMAT: must be byte-identical to the OffRamp's `Any2SVMMessageV2`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Any2SVMMessage {
    pub message_id: [u8; 32],
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
    pub data: Vec<u8>,
    pub token_transfer: Option<TokenTransfer>,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Debug, Default)]
pub struct ReceivedMessage {
    pub message_id: [u8; 32],
    pub source_chain_selector: u64,
    #[max_len(MAX_SENDER_ADDRESS_SIZE)]
    pub sender: Vec<u8>,
    #[max_len(MAX_MESSAGE_DATA_SIZE)]
    pub data: Vec<u8>,
    pub token_transfer: Option<TokenTransfer>,
    pub received_timestamp: i64,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct MessagesStorage {
    pub last_updated: i64,
    pub message_count: u64,
    pub latest_message: ReceivedMessage,
}

/// Mirrors `ccip_common::ccvs::GetReceiverCcvsIn`.
#[derive(Clone, AnchorSerialize, AnchorDeserialize, Debug)]
pub struct GetReceiverCcvsIn {
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
}

/// Mirrors `ccip_common::ccvs::GetReceiverCcvsOut`.
#[derive(Clone, AnchorSerialize, AnchorDeserialize, Debug, Default)]
pub struct GetReceiverCcvsOut {
    pub required_ccvs: Vec<Pubkey>,
    pub optional_ccvs: Vec<Pubkey>,
    pub optional_threshold: u8,
    pub allowed_finality_config: FinalityConfig,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SetCcvConfigParams {
    pub source_chain_selector: u64,
    /// CCV program IDs that must verify every message. Empty = lane defaults.
    pub required_ccvs: Vec<Pubkey>,
    pub optional_ccvs: Vec<Pubkey>,
    pub optional_threshold: u8,
    /// Faster-Than-Finality policy, e.g. `{ flags: 0, block_depth: 1 }` allows any depth >= 1.
    pub allowed_finality_config: FinalityConfig,
}
