use anchor_lang::prelude::*;

use crate::error::SenderError;
use crate::program::CcipSenderV2;
use crate::state::{BaseState, CCIP_SENDER, STATE_SEED};
use crate::ANCHOR_DISCRIMINATOR;

pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
    let state = BaseState::new(
        ctx.accounts.authority.key(),
        router,
        ctx.bumps.state,
        ctx.bumps.ccip_sender,
    )?;
    ctx.accounts.state.set_inner(state);
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [STATE_SEED],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + BaseState::INIT_SPACE,
    )]
    pub state: Account<'info, BaseState>,
    /// CHECK: the PDA that signs the CPI into the router and custodies tokens. Only its bump is
    /// read here, to be stored in `state`.
    #[account(
        seeds = [CCIP_SENDER],
        bump,
    )]
    pub ccip_sender: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, CcipSenderV2>,
    // Initialization only allowed by program upgrade authority
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ SenderError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
}
