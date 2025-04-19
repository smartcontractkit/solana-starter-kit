use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::{
    constants::{ALLOWED_OFFRAMP, EXTERNAL_EXECUTION_CONFIG_SEED, MESSAGES_STORAGE_SEED, STATE_SEED, TOKEN_VAULT_SEED},
    error::CCIPReceiverError,
    state::{Any2SVMMessage, BaseState, MessagesStorage},
};

/// Accounts required for initializing the CCIP Receiver program
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The payer of the transaction, will become the owner
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The state account to be initialized
    #[account(
        init,
        payer = payer,
        space = 8 + BaseState::INIT_SPACE,
        seeds = [STATE_SEED],
        bump
    )]
    pub state: Account<'info, BaseState>,

    /// Program state account for verification
    pub system_program: Program<'info, System>,
}

/// Accounts required for initializing a token vault
#[derive(Accounts)]
pub struct InitializeTokenVault<'info> {
    /// The payer of the transaction
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The state account for authority validation
    #[account(
        seeds = [STATE_SEED],
        bump,
        constraint = state.owner == payer.key() @ CCIPReceiverError::Unauthorized
    )]
    pub state: Account<'info, BaseState>,

    /// The mint associated with this token vault
    pub token_mint: Account<'info, Mint>,

    /// The token vault to be initialized
    #[account(
        init,
        payer = payer,
        token::mint = token_mint,
        token::authority = token_vault_authority,
        seeds = [TOKEN_VAULT_SEED, token_mint.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// The authority of the token vault (PDA)
    /// CHECK: This is a PDA used as the token vault authority
    #[account(
        seeds = [TOKEN_VAULT_SEED],
        bump
    )]
    pub token_vault_authority: UncheckedAccount<'info>,

    /// System program for account creation
    pub system_program: Program<'info, System>,
    
    /// Token program for token vault initialization
    pub token_program: Program<'info, Token>,
}

/// Accounts required for receiving a CCIP message
#[derive(Accounts)]
#[instruction(message: Any2SVMMessage, token_amount: u64)]
pub struct CcipReceive<'info> {
    /// The authority PDA from the offramp program that must sign the transaction
    /// This ensures only authorized offramp programs can call this function
    #[account(
        seeds = [EXTERNAL_EXECUTION_CONFIG_SEED, crate::ID.as_ref()],
        bump,
        seeds::program = offramp_program.key(),
    )]
    pub authority: Signer<'info>,

    /// The offramp program account
    /// Used for deriving PDA seeds
    /// CHECK: offramp program: exists only to derive the allowed offramp PDA and the authority PDA
    pub offramp_program: UncheckedAccount<'info>,

    /// PDA from the router program that verifies this offramp is allowed
    /// If this PDA doesn't exist, the router doesn't allow this offramp
    /// CHECK: PDA of the router program verifying the signer is an allowed offramp
    #[account(
        owner = state.router @ CCIPReceiverError::InvalidCaller, // this guarantees that it was initialized
        seeds = [
            ALLOWED_OFFRAMP,
            message.source_chain_selector.to_le_bytes().as_ref(),
            offramp_program.key().as_ref()
        ],
        bump,
        seeds::program = state.router,
    )]
    pub allowed_offramp: UncheckedAccount<'info>,

    /// Program state account for verification
    #[account(
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: Account<'info, BaseState>,

    /// Storage for received messages
    /// Will be updated with the latest message
    #[account(
        mut,
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,

    // Note: Token-related accounts are dynamically provided in remaining_accounts
}

/// Accounts required for retrieving the latest message
#[derive(Accounts)]
pub struct GetLatestMessage<'info> {
    /// The messages storage account to read from
    #[account(
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,
} 