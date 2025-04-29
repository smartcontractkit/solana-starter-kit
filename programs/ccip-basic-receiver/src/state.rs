use anchor_lang::prelude::*;

// Define maximum sizes for tutorial purposes
pub const MAX_MESSAGE_DATA_SIZE: usize = 1024; // 1KB limit for message data
pub const MAX_TOKEN_AMOUNTS: usize = 10;      // Limit to 10 token transfers
pub const MAX_SENDER_ADDRESS_SIZE: usize = 64; // Max 64 bytes for sender address

/// Core state account for the CCIP Receiver program
/// This account stores essential configuration like owner and router
#[account]
#[derive(InitSpace, Default, Debug)]
pub struct BaseState {
    /// The owner of this CCIP Receiver program
    pub owner: Pubkey,
    /// The CCIP Router program ID that this receiver works with
    pub router: Pubkey,
}

/// Account for storing received cross-chain messages
/// Keeps track of the latest message and some metadata
#[account]
#[derive(Debug)]
pub struct MessagesStorage {
    /// Timestamp of when this storage was last updated
    pub last_updated: i64,
    /// Total count of messages received since initialization
    pub message_count: u64,
    /// The most recently received cross-chain message
    pub latest_message: ReceivedMessage,
}

/// Enum representing different types of cross-chain messages
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq)]
pub enum MessageType {
    /// Message only contains token transfers, no data payload
    #[default]
    TokenTransfer,
    /// Message only contains data payload, no token transfers
    ArbitraryMessaging,
    /// Message contains both data payload and token transfers
    /// Indicates the data is related to the token transfer (e.g., instructions)
    ProgrammaticTokenTransfer,
}

/// Struct representing a received cross-chain message
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct ReceivedMessage {
    /// Unique identifier of the cross-chain message
    pub message_id: [u8; 32],
    /// Type of the message (token transfer, arbitrary message, or both)
    pub message_type: MessageType,
    /// Arbitrary data payload in the message
    pub data: Vec<u8>,
    /// List of token transfers included in the message
    pub token_amounts: Vec<SVMTokenAmount>,
    /// Timestamp when the message was received
    pub received_timestamp: i64,
    /// Identifier of the source blockchain (chain selector)
    pub source_chain_selector: u64,
    /// Address of the sender on the source chain (in bytes)
    pub sender: Vec<u8>,
}

/// Struct representing a cross-chain message format from any chain to Solana VM
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Any2SVMMessage {
    /// Unique identifier of the cross-chain message
    pub message_id: [u8; 32],
    /// Identifier of the source blockchain (chain selector)
    pub source_chain_selector: u64,
    /// Address of the sender on the source chain (in bytes)
    pub sender: Vec<u8>,
    /// Arbitrary data payload in the message
    pub data: Vec<u8>,
    /// List of token transfers included in the message
    pub token_amounts: Vec<SVMTokenAmount>,
}

/// Struct representing a token amount in a cross-chain transfer
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SVMTokenAmount {
    /// The mint address of the token on Solana
    pub token: Pubkey,
    /// The amount of tokens (denominated in Solana token amount)
    pub amount: u64,
} 