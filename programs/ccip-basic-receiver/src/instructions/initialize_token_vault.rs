use anchor_lang::prelude::*;
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
    // Emit vault initialization event
    emit!(TokenVaultInitialized {
        token_mint: ctx.accounts.token_mint.key(),
        token_vault: ctx.accounts.token_vault.key(),
    });
    
    Ok(())
} 