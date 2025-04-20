use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, sysvar::rent::Rent};
use anchor_spl::token_2022::spl_token_2022;
use crate::{
    context::InitializeTokenVault,
    events::TokenVaultInitialized,
};

/// Initialize a token vault for a specific token mint
/// 
/// This function creates a token vault for a specific mint. The vault
/// will be used to receive tokens from cross-chain transfers.
///
/// # Arguments
/// * `ctx` - The context of accounts for this instruction
pub fn handler(ctx: Context<InitializeTokenVault>) -> Result<()> {
    // Build instruction with spl-token-2022 for proper structure
    let mut ix = spl_token_2022::instruction::initialize_account3(
        &spl_token_2022::ID,
        &ctx.accounts.token_vault.key(),
        &ctx.accounts.token_mint.key(),
        &ctx.accounts.token_vault_authority.key(),
    )?;
    
    // Replace the program ID with the actual token program from accounts
    ix.program_id = ctx.accounts.token_program.key();
    
    // Execute the instruction
    invoke(
        &ix,
        &[
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.token_vault_authority.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    
    // Emit vault initialization event
    emit!(TokenVaultInitialized {
        token_mint: ctx.accounts.token_mint.key(),
        token_vault: ctx.accounts.token_vault.key(),
    });
    
    Ok(())
} 