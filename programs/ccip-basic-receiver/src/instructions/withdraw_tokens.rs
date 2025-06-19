use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_2022::spl_token_2022;
use crate::{
    constants::TOKEN_ADMIN_SEED,
    context::WithdrawTokens,
};

/// Withdraw tokens from a program-controlled token account
/// 
/// This function allows the program owner to withdraw tokens from a token account
/// that is owned by the program (via the token_admin PDA). The tokens are sent to
/// the specified destination token account.
///
/// # Arguments
/// * `ctx` - The context of accounts for this instruction
/// * `amount` - The amount of tokens to withdraw
/// * `decimals` - The number of decimals for the token
///
/// # Returns
/// * `Result<()>` - Result indicating success or failure
pub fn handler(ctx: Context<WithdrawTokens>, amount: u64, decimals: u8) -> Result<()> {
    // Create the transfer instruction using token-2022 layout
    let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
        &spl_token_2022::ID, // Use Token-2022 to build instruction structure
        &ctx.accounts.program_token_account.key(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.to_token_account.key(),
        &ctx.accounts.token_admin.key(),
        &[],
        amount,
        decimals,
    )?;
    
    // Replace with actual token program
    transfer_ix.program_id = ctx.accounts.token_program.key();
    
    // Derive the PDA signer seeds for the token admin
    let seeds = &[TOKEN_ADMIN_SEED, &[ctx.bumps.token_admin]];
    let signer_seeds = &[&seeds[..]];
    
    // Execute the token transfer with the PDA as signer
    invoke_signed(
        &transfer_ix,
        &[
            ctx.accounts.program_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to_token_account.to_account_info(),
            ctx.accounts.token_admin.to_account_info(),
        ],
        signer_seeds,
    )?;
    
    msg!("Withdrew {} tokens to {}", amount, ctx.accounts.to_token_account.key());
    
    Ok(())
} 