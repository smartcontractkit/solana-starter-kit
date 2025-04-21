use anchor_lang::prelude::*;

/// Event emitted when the receiver program is initialized
#[event]
pub struct ReceiverInitialized {
    /// The pubkey of the program owner
    pub owner: Pubkey,
    /// The pubkey of the router program
    pub router: Pubkey,
}

/// Event emitted when a cross-chain message is received
#[event]
pub struct MessageReceived {
    /// Unique identifier of the cross-chain message
    pub message_id: [u8; 32],
    /// Identifier of the source blockchain (chain selector)
    pub source_chain_selector: u64,
    /// Address of the sender on the source chain (in bytes)
    pub sender: Vec<u8>,
    /// Length of the data payload in the message
    pub data_length: u64,
    /// Number of token transfers included in the message
    pub token_count: u8,
}

/// Event emitted when tokens are received in a cross-chain transfer
#[event]
pub struct TokenReceived {
    /// The mint address of the received token
    pub token: Pubkey,
    /// The amount of tokens received
    pub amount: u64,
    /// Index of the token in the message's token list
    pub index: u8,
}

/// Event emitted when tokens are forwarded to a recipient
#[event]
pub struct TokensForwarded {
    /// The mint address of the forwarded token
    pub token: Pubkey,
    /// The amount of tokens forwarded
    pub amount: u64,
    /// The recipient's token account address
    pub recipient: Pubkey,
} 