use anchor_lang::prelude::*;

use crate::error::SenderError;
use crate::state::{BaseState, RemoteChainConfig, CHAIN_CONFIG_SEED, STATE_SEED};
use crate::ANCHOR_DISCRIMINATOR;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ChainConfigParams {
    pub chain_selector: u64,
    pub recipient: Vec<u8>,
    pub extra_args_bytes: Vec<u8>,
}

/// Creates the config for a destination chain. Its existence is what allows sends to that
/// chain; `remove_chain_config` closes it again.
pub fn init_chain_config(ctx: Context<InitChainConfig>, params: ChainConfigParams) -> Result<()> {
    let bump = ctx.bumps.chain_config;
    ctx.accounts.chain_config.set_inner(RemoteChainConfig::new(
        bump,
        params.recipient,
        params.extra_args_bytes,
    ));
    Ok(())
}

/// Updates a destination chain's config. Separate from `init_chain_config` because changing
/// the extra args needs a realloc.
pub fn update_chain_config(
    ctx: Context<UpdateChainConfig>,
    params: ChainConfigParams,
) -> Result<()> {
    let bump = ctx.accounts.chain_config.bump;
    ctx.accounts.chain_config.set_inner(RemoteChainConfig::new(
        bump,
        params.recipient,
        params.extra_args_bytes,
    ));
    Ok(())
}

/// Disables a destination chain by closing its config account. Reversible via
/// `init_chain_config`.
pub fn remove_chain_config(_ctx: Context<RemoveChainConfig>, _chain_selector: u64) -> Result<()> {
    Ok(())
}

#[derive(Accounts, Debug)]
#[instruction(params: ChainConfigParams)]
pub struct InitChainConfig<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        init,
        seeds = [CHAIN_CONFIG_SEED, params.chain_selector.to_le_bytes().as_ref()],
        bump,
        space = ANCHOR_DISCRIMINATOR + RemoteChainConfig::INIT_SPACE + params.extra_args_bytes.len(),
        payer = authority,
    )]
    pub chain_config: Account<'info, RemoteChainConfig>,
    #[account(
        mut,
        address = state.owner @ SenderError::OnlyOwner,
    )]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Debug)]
#[instruction(params: ChainConfigParams)]
pub struct UpdateChainConfig<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        mut,
        seeds = [CHAIN_CONFIG_SEED, params.chain_selector.to_le_bytes().as_ref()],
        bump = chain_config.bump,
        realloc = ANCHOR_DISCRIMINATOR + RemoteChainConfig::INIT_SPACE + params.extra_args_bytes.len(),
        realloc::payer = authority,
        realloc::zero = true,
    )]
    pub chain_config: Account<'info, RemoteChainConfig>,
    #[account(
        mut,
        address = state.owner @ SenderError::OnlyOwner,
    )]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Debug)]
#[instruction(chain_selector: u64)]
pub struct RemoveChainConfig<'info> {
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        mut,
        seeds = [CHAIN_CONFIG_SEED, chain_selector.to_le_bytes().as_ref()],
        bump = chain_config.bump,
        close = authority,
    )]
    pub chain_config: Account<'info, RemoteChainConfig>,
    #[account(
        mut,
        address = state.owner @ SenderError::OnlyOwner,
    )]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
