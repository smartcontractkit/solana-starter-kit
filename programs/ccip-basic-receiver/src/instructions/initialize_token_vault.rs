use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::{
    constants::{STATE_SEED, TOKEN_VAULT_SEED},
    error::CCIPReceiverError,
    events::TokenVaultInitialized,
    state::BaseState,
};

/// Accounts required for initializing a token vault
#[derive(Accounts)]
pub struct InitializeTokenVault<'info> {
    /// Program state account for verification
    /// Used to check that the caller is the program owner
    #[account(
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: Account<'info, BaseState>,

    /// The authority (signer) that must be the program owner
    /// This account pays for the initialization of the token vault
    #[account(
        mut,
        address = state.owner @ CCIPReceiverError::OnlyOwner,
    )]
    pub authority: Signer<'info>,

    /// The mint of the token for which to create a vault
    pub token_mint: Account<'info, Mint>,

    /// The token vault account that will be initialized
    /// This account will hold the tokens received from cross-chain transfers
    #[account(
        init,
        payer = authority,
        seeds = [TOKEN_VAULT_SEED, token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = token_vault_authority,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// The authority that controls the token vault
    /// This is a PDA owned by the program to enable programmatic transfers
    /// CHECK: This is the PDA that will have authority over the token vault
    #[account(
        seeds = [TOKEN_VAULT_SEED],
        bump,
    )]
    pub token_vault_authority: UncheckedAccount<'info>,

    /// SPL Token program
    pub token_program: Program<'info, Token>,

    /// System program reference
    pub system_program: Program<'info, System>,

    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

/// Initialize a token vault for a specific token mint
/// 
/// This function creates a token account (vault) for a specific mint,
/// controlled by the program. This vault will be used to receive tokens 
/// from cross-chain transfers before they are forwarded to recipients.
///
/// # Arguments
/// * `ctx` - The context of accounts involved in this instruction
pub fn initialize_token_vault_handler(ctx: Context<InitializeTokenVault>) -> Result<()> {
    // Emit event for the new token vault
    emit!(TokenVaultInitialized {
        token_mint: ctx.accounts.token_mint.key(),
        token_vault: ctx.accounts.token_vault.key(),
    });

    Ok(())
} 