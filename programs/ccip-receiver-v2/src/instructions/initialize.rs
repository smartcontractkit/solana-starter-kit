use anchor_lang::prelude::*;

use crate::error::CcipReceiverError;
use crate::program::CcipReceiverV2;
use crate::state::{Config, CONFIG_SEED, CONFIG_V};
use crate::ANCHOR_DISCRIMINATOR;

/// Initialization is the responsibility of the external user; CCIP does not initialize receiver
/// accounts. Creates the `Config` PDA (owner + router).
///
/// NOTE: the `token_admin` PDA (the authority / CPI-signer for the receiver's token accounts) is
/// intentionally NOT created here. A PDA used purely as a signer needs no on-chain account — it is
/// derived and signed for via `invoke_signed` at withdrawal time (see `WithdrawTokens`), so
/// creating it would only waste rent.
pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
    let authority = ctx.accounts.authority.key();
    let bump = ctx.bumps.config;
    let config = &mut ctx.accounts.config;
    config.version = CONFIG_V;
    config.bump = bump;
    config.init(authority, router)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [CONFIG_SEED],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + Config::INIT_SPACE,
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, CcipReceiverV2>,
    // Initialization only allowed by program upgrade authority
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ CcipReceiverError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
}
