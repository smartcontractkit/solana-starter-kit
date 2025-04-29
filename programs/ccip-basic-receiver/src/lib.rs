use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_spl::token::TokenAccount;
// use instructions::*; // Remove this unused import

/// Program constants
mod constants;
/// Context definitions for account validation
mod context;
/// Error definitions
mod error;
/// Event definitions
mod events;
/// Instruction handlers
mod instructions;
/// Program state definitions
mod state;

// Re-export account structures for use in program entry points
use context::*;

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

/// CCIP Basic Receiver Program
///
/// A Solana program that demonstrates how to receive and process CCIP messages.
/// It supports receiving both arbitrary data and token transfers from other chains.
#[program]
pub mod ccip_basic_receiver {
    use super::*;

    /// Initialize the CCIP receiver program
    /// @param router - The CCIP router program ID
    pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
        instructions::initialize_handler(ctx, router)
    }

    /// Receive a CCIP message
    pub fn ccip_receive(ctx: Context<CcipReceive>, message: state::Any2SVMMessage) -> Result<()> {
        instructions::ccip_receive_handler(ctx, message)
    }

    /// Get the latest message received
    pub fn get_latest_message(ctx: Context<GetLatestMessage>) -> Result<state::ReceivedMessage> {
        instructions::get_latest_message_handler(ctx)
    }

    /// Withdraw tokens from a program token account
    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, amount: u64, decimals: u8) -> Result<()> {
        instructions::withdraw_tokens_handler(ctx, amount, decimals)
    }

    /// Closes the messages storage account and returns lamports to the owner.
    pub fn close_storage(_ctx: Context<CloseStorage>) -> Result<()> {
        // No handler logic needed, Anchor handles the closing via the `close` constraint
        Ok(())
    }
}
