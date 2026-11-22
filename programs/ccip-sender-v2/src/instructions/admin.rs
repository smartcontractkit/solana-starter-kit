use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::spl_token_2022::{self, instruction::transfer_checked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::error::SenderError;
use crate::state::{BaseState, CCIP_SENDER, STATE_SEED};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct WithdrawTokensParams {
    pub amount: u64,
    pub decimals: u8,
}

pub fn update_router(ctx: Context<UpdateConfig>, new_router: Pubkey) -> Result<()> {
    ctx.accounts
        .state
        .update_router(ctx.accounts.authority.key(), new_router)
}

pub fn transfer_ownership(ctx: Context<UpdateConfig>, proposed_owner: Pubkey) -> Result<()> {
    ctx.accounts
        .state
        .transfer_ownership(ctx.accounts.authority.key(), proposed_owner)
}

pub fn accept_ownership(ctx: Context<AcceptOwnership>) -> Result<()> {
    ctx.accounts
        .state
        .accept_ownership(ctx.accounts.authority.key())
}

/// Creates this program's associated token account for `mint`, idempotently.
pub fn init_ccip_sender_ata(_ctx: Context<InitCcipSenderAta>) -> Result<()> {
    Ok(())
}

pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, params: WithdrawTokensParams) -> Result<()> {
    let mut ix = transfer_checked(
        &spl_token_2022::ID, // use spl-token-2022 to compile instruction - change program later
        &ctx.accounts.program_token_account.key(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.to_token_account.key(),
        &ctx.accounts.ccip_sender.key(),
        &[],
        params.amount,
        params.decimals,
    )?;
    ix.program_id = ctx.accounts.token_program.key(); // set to user specified program

    let bump = ctx.accounts.state.ccip_sender_bump;
    let seeds: &[&[u8]] = &[CCIP_SENDER, std::slice::from_ref(&bump)];
    invoke_signed(
        &ix,
        &[
            ctx.accounts.program_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to_token_account.to_account_info(),
            ctx.accounts.ccip_sender.to_account_info(),
        ],
        &[seeds],
    )?;
    Ok(())
}

#[derive(Accounts, Debug)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        address = state.owner @ SenderError::OnlyOwner,
    )]
    pub authority: Signer<'info>,
}

#[derive(Accounts, Debug)]
pub struct AcceptOwnership<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        address = state.proposed_owner @ SenderError::OnlyProposedOwner,
    )]
    pub authority: Signer<'info>,
}

/// Creates the `ccip_sender` PDA's associated token account for a mint.
///
/// The router validates that PDA's token account (as the message sender's token account, and as
/// the fee payer's) before doing any work, so it must exist before the first `ccip_send` that uses
/// the mint. The 1.6 sender relied on `associated_token::` constraints on named accounts to surface
/// a missing ATA; this program forwards those accounts unchecked, so it creates them explicitly
/// instead.
// No `Debug` derive: `Interface` and `Program<AssociatedToken>` don't implement it.
#[derive(Accounts)]
pub struct InitCcipSenderAta<'info> {
    #[account(
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = ccip_sender,
        associated_token::token_program = token_program,
    )]
    pub ccip_sender_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        owner = token_program.key(),
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: PDA that owns the ATA; the seeds constraint is the check.
    #[account(
        seeds = [CCIP_SENDER],
        bump = state.ccip_sender_bump,
    )]
    pub ccip_sender: UncheckedAccount<'info>,
    // PERMISSIONLESS: creating this program's own ATA is harmless and the caller pays for it.
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Debug)]
pub struct WithdrawTokens<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = ccip_sender,
        token::token_program = token_program,
    )]
    pub program_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub to_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(owner = token_program.key())]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: CPI to token program
    pub token_program: UncheckedAccount<'info>,
    #[account(
        seeds = [CCIP_SENDER],
        bump = state.ccip_sender_bump,
    )]
    /// CHECK: CPI signer for tokens
    pub ccip_sender: UncheckedAccount<'info>,
    #[account(
        address = state.owner @ SenderError::OnlyOwner,
    )]
    pub authority: Signer<'info>,
}
