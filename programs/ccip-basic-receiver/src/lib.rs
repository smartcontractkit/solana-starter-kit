use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

/// Program constants
pub mod constants;
/// Error definitions
pub mod error;
/// Event definitions
pub mod events;
/// Instruction handlers and account structures
pub mod instructions;
/// Program state definitions
pub mod state;

use crate::constants::*;
use crate::error::CCIPReceiverError;
use crate::events::*;
use crate::state::*;
// Import the instruction account structures and handlers
use crate::instructions::*;

declare_id!("671b2A65jR5QxwYFSuEMBhQ6bWJKkGMheEp3ReWC9WnB");

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
        initialize_handler(ctx, router)
    }

    /// Initialize a token vault for a specific token mint
    /// This vault will be used to receive tokens from cross-chain transfers
    pub fn initialize_token_vault(ctx: Context<InitializeTokenVault>) -> Result<()> {
        initialize_token_vault_handler(ctx)
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
    /// @param token_amount - The amount of token received in this transaction
    pub fn ccip_receive(
        ctx: Context<CcipReceive>, 
        message: Any2SVMMessage,
        token_amount: u64
    ) -> Result<()> {
        ccip_receive_handler(ctx, message, token_amount)
    }

    /// Get the latest received message
    pub fn get_latest_message(ctx: Context<GetLatestMessage>) -> Result<ReceivedMessage> {
        get_latest_message_handler(ctx)
    }
}

// No need to duplicate the account structures here since they are imported
// from the instruction modules through the instructions::* import 