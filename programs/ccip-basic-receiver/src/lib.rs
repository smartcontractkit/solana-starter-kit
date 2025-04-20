use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use anchor_lang::solana_program::pubkey::Pubkey;

/// Program constants
pub mod constants;
/// Context definitions for account validation
pub mod context;
/// Error definitions
pub mod error;
/// Event definitions
pub mod events;
/// Instruction handlers
pub mod instructions;
/// Program state definitions
pub mod state;

// Re-export account structures and state types for use in program entry points
pub use context::*;
pub use state::*;

declare_id!("BqmcnLFSbKwyMEgi7VhVeJCis1wW26VySztF34CJrKFq");

/// Token program IDs
pub mod token_programs {
    use anchor_lang::solana_program::pubkey::Pubkey;
    use anchor_spl::token::ID as TOKEN_PROGRAM_ID;
    use anchor_spl::token_2022::ID as TOKEN_2022_PROGRAM_ID;

    // SPL Token program ID
    pub const ID: Pubkey = TOKEN_PROGRAM_ID;
    // Token 2022 program ID
    pub const TOKEN_2022_ID: Pubkey = TOKEN_2022_PROGRAM_ID;
}

/// Utility function to determine if a token program is supported
pub fn is_supported_token_program(program_id: &Pubkey) -> bool {
    program_id == &token_programs::ID || program_id == &token_programs::TOKEN_2022_ID
}

/// Helper to get the appropriate space for a token account based on program
pub fn get_token_account_space(program_id: &Pubkey) -> usize {
    if program_id == &token_programs::TOKEN_2022_ID {
        165 // Base size for Token-2022 accounts
    } else {
        TokenAccount::LEN // Standard token account size
    }
}

/// CCIP Receiver program that accepts cross-chain messages from Chainlink CCIP.
/// 
/// This program provides a simplified implementation for receiving cross-chain messages
/// from any chain through Chainlink's Cross-Chain Interoperability Protocol (CCIP).
/// 
/// The program supports:
/// - Receiving arbitrary data messages
/// - Receiving token transfers
/// - Programmatic token transfers (data + tokens)
/// - Forwarding received tokens to recipient accounts
///
/// This program is designed for educational purposes and shows core concepts of
/// CCIP integration on Solana, including:
/// - PDA-based security model for validating caller (router)
/// - Dynamic handling of token transfers using `remaining_accounts`
/// - Cross-program invocation (CPI) for token transfers
/// - Flexible message processing
#[program]
pub mod ccip_basic_receiver {
    use super::*;
    
    /// Initialize the receiver program state
    /// @param router - The CCIP router program ID
    pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
        instructions::initialize_handler(ctx, router)
    }

    /// Initialize a token vault for a specific token mint
    /// This vault will be used to receive tokens from cross-chain transfers
    pub fn initialize_token_vault(ctx: Context<InitializeTokenVault>) -> Result<()> {
        instructions::initialize_token_vault_handler(ctx)
    }

    /// This function is called by the CCIP Router to handle incoming cross-chain messages.
    /// It processes message data and forwards tokens to recipient accounts dynamically using remaining_accounts.
    ///
    /// For the tutorial, the remaining_accounts should contain these accounts in order:
    /// 1. token_mint: Account<Mint>
    /// 2. token_vault: Account<TokenAccount>
    /// 3. token_vault_authority: UncheckedAccount
    /// 4. recipient_token_account: Account<TokenAccount>
    /// 5. token_program: Program<Token>
    ///
    /// @param message - The cross-chain message from the source chain
    pub fn ccip_receive(
        ctx: Context<CcipReceive>, 
        message: Any2SVMMessage,
    ) -> Result<()> {
        instructions::ccip_receive_handler(ctx, message)
    }

    /// Get the latest received message
    pub fn get_latest_message(ctx: Context<GetLatestMessage>) -> Result<ReceivedMessage> {
        instructions::get_latest_message_handler(ctx)
    }
}
