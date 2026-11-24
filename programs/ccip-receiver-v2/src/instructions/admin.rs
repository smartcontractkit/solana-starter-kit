use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_2022::spl_token_2022::{self, instruction::transfer_checked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::error::CcipReceiverError;
use crate::state::{
    ApprovedSender, Config, APPROVED_SENDER_SEED, CONFIG_SEED, MAX_SENDER_ADDRESS_LEN,
    TOKEN_ADMIN_SEED,
};
use crate::ANCHOR_DISCRIMINATOR;

/// Params for [`approve_sender`] / [`unapprove_sender`] (INV-LINT-PARAMS: single struct arg).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SenderParams {
    pub chain_selector: u64,
    pub remote_sender: Vec<u8>,
}

/// Params for [`withdraw_tokens`] (INV-LINT-PARAMS: single struct arg).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct WithdrawTokensParams {
    pub amount: u64,
    pub decimals: u8,
}

pub fn update_router(ctx: Context<UpdateConfig>, new_router: Pubkey) -> Result<()> {
    ctx.accounts
        .config
        .update_router(ctx.accounts.authority.key(), new_router)
}

pub fn transfer_ownership(ctx: Context<UpdateConfig>, proposed_owner: Pubkey) -> Result<()> {
    ctx.accounts
        .config
        .transfer_ownership(ctx.accounts.authority.key(), proposed_owner)
}

pub fn accept_ownership(ctx: Context<AcceptOwnership>) -> Result<()> {
    ctx.accounts
        .config
        .accept_ownership(ctx.accounts.authority.key())
}

/// Creates a PDA approving the specific (source chain, remote sender) pair to deliver messages.
pub fn approve_sender(_ctx: Context<ApproveSender>, _params: SenderParams) -> Result<()> {
    // The `approved_sender` marker PDA is created (with no data) by the `init` constraint in
    // `ApproveSender`; its mere existence conveys approval, so there is nothing to write here.
    Ok(())
}

pub fn unapprove_sender(_ctx: Context<UnapproveSender>, _params: SenderParams) -> Result<()> {
    // No body logic: the `approved_sender` account in `UnapproveSender` is declared with
    // `close = authority`, so Anchor closes the marker PDA on instruction exit. Removing the PDA
    // revokes the approval — a subsequent `ccip_receive_v2` for that (chain, sender) pair will fail
    // to deserialize the now-missing account and reject the message.
    Ok(())
}

pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, params: WithdrawTokensParams) -> Result<()> {
    let mut ix = transfer_checked(
        &spl_token_2022::ID, // use spl-token-2022 to compile instruction - change program later
        &ctx.accounts.program_token_account.key(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.to_token_account.key(),
        &ctx.accounts.token_admin.key(),
        &[],
        params.amount,
        params.decimals,
    )?;
    ix.program_id = ctx.accounts.token_program.key(); // set to user specified program

    let seeds = &[TOKEN_ADMIN_SEED, &[ctx.bumps.token_admin]];
    invoke_signed(
        &ix,
        &[
            ctx.accounts.program_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to_token_account.to_account_info(),
            ctx.accounts.token_admin.to_account_info(),
        ],
        &[&seeds[..]],
    )?;
    Ok(())
}

#[derive(Accounts, Debug)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(address = config.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
}

#[derive(Accounts, Debug)]
pub struct AcceptOwnership<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(address = config.proposed_owner @ CcipReceiverError::OnlyProposedOwner)]
    pub authority: Signer<'info>,
}

#[derive(Accounts, Debug)]
#[instruction(params: SenderParams)]
pub struct ApproveSender<'info> {
    // The sender-length check lives here rather than in the instruction body because Anchor
    // validates accounts in declaration order, and `approved_sender`'s seed derivation (below)
    // aborts on an over-long seed before any body code can run. Checking on the first-declared
    // account turns an opaque `MaxSeedLengthExceeded` abort into a typed error.
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = params.remote_sender.len() <= MAX_SENDER_ADDRESS_LEN
            @ CcipReceiverError::SenderAddressTooLong,
    )]
    pub config: Account<'info, Config>,
    #[account(
        init,
        seeds = [
            APPROVED_SENDER_SEED,
            params.chain_selector.to_le_bytes().as_ref(),
            &params.remote_sender,
        ],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + ApprovedSender::INIT_SPACE,
    )]
    pub approved_sender: Account<'info, ApprovedSender>,
    #[account(mut, address = config.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Debug)]
#[instruction(params: SenderParams)]
pub struct UnapproveSender<'info> {
    // See `ApproveSender` for why the length check is attached to this account.
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = params.remote_sender.len() <= MAX_SENDER_ADDRESS_LEN
            @ CcipReceiverError::SenderAddressTooLong,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [
            APPROVED_SENDER_SEED,
            params.chain_selector.to_le_bytes().as_ref(),
            &params.remote_sender,
        ],
        bump,
        close = authority,
    )]
    pub approved_sender: Account<'info, ApprovedSender>,
    #[account(mut, address = config.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Debug)]
pub struct WithdrawTokens<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = token_admin,
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
    #[account(seeds = [TOKEN_ADMIN_SEED], bump)]
    /// CHECK: CPI signer for tokens
    pub token_admin: UncheckedAccount<'info>,
    #[account(address = config.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
}
