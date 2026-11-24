use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use ccip_common::seed;

use crate::error::CcipReceiverError;
use crate::state::{Config, CONFIG_SEED};

/// Discriminator of the router's `register_receiver` instruction, so this program can build the CPI
/// without a direct dependency on the router crate. Same value as
/// `anchor_discriminator!("register_receiver")` (sha256("global:register_receiver")[..8]).
const ROUTER_REGISTER_RECEIVER_DISCRIMINATOR: [u8; 8] = [106, 6, 232, 177, 224, 105, 25, 128];

/// This receiver's CCIP interface version, as understood by the router's `ReceiverRegistry`.
const RECEIVER_VERSION_V2: u8 = 2;

/// Registers this program as a CCIP **v2** receiver in the router.
///
/// Only the program's owner may call it. It CPIs the router's `register_receiver`,
/// signing with this program's `RECEIVER_REGISTRATION_SIGNER` PDA — only this program can
/// `invoke_signed` for that PDA, which is exactly how the router proves the registration was
/// authorized by the receiver program itself. The receiver's admin never calls the router directly.
pub fn register_with_router(ctx: Context<RegisterWithRouter>) -> Result<()> {
    let router = ctx.accounts.router_program.key();

    // register_receiver(receiver_program: Pubkey, receiver_version: u8)
    let mut data = Vec::with_capacity(8 + 32 + 1);
    data.extend_from_slice(&ROUTER_REGISTER_RECEIVER_DISCRIMINATOR);
    crate::ID.serialize(&mut data)?; // receiver_program = this program
    RECEIVER_VERSION_V2.serialize(&mut data)?; // receiver_version = 2

    // Account order matches the router's `RegisterReceiver` context 1:1, including the two trailing
    // accounts injected by the router's `#[event_cpi]` (event_authority, program):
    //   [receiver_registry, config, receiver_registration_signer, authority, payer, system_program,
    //    router_program, event_authority]
    // We take the self-registration path, so the router's `authority` is our `registration_signer`
    // PDA (only this program can `invoke_signed` for it). Our `authority` (the config.owner) is
    // the router's separate rent `payer`.
    let accounts = vec![
        AccountMeta::new(ctx.accounts.receiver_registry.key(), false), // receiver_registry
        AccountMeta::new_readonly(ctx.accounts.router_config.key(), false), // config
        AccountMeta::new_readonly(ctx.accounts.registration_signer.key(), true), // receiver_registration_signer
        AccountMeta::new_readonly(ctx.accounts.registration_signer.key(), true), // authority (self-reg: == registration_signer)
        AccountMeta::new(ctx.accounts.authority.key(), true),                    // payer (rent)
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),     // system_program
        AccountMeta::new_readonly(ctx.accounts.router_event_authority.key(), false), // event_cpi: event_authority
        AccountMeta::new_readonly(router, false),
    ];

    let ix = Instruction {
        program_id: router,
        accounts,
        data,
    };

    let signer_seeds: &[&[&[u8]]] = &[&[
        seed::RECEIVER_REGISTRATION_SIGNER,
        router.as_ref(),
        &[ctx.bumps.registration_signer],
    ]];

    invoke_signed(
        &ix,
        &[
            ctx.accounts.receiver_registry.to_account_info(),
            ctx.accounts.router_config.to_account_info(),
            ctx.accounts.registration_signer.to_account_info(),
            ctx.accounts.registration_signer.to_account_info(),
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.router_event_authority.to_account_info(),
            ctx.accounts.router_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct RegisterWithRouter<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    /// The owner; also the rent payer forwarded to the router CPI.
    #[account(mut,
        address = config.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,

    /// The receiver-side signer PDA that authenticates the CPI to the router. Only this program can
    /// `invoke_signed` for it, so the router accepts it as proof of self-registration.
    /// CHECK: signer-only PDA, derivation enforced by `seeds`/`bump`; no data is read or written.
    #[account(seeds = [seed::RECEIVER_REGISTRATION_SIGNER, router_program.key().as_ref()], bump)]
    pub registration_signer: UncheckedAccount<'info>,

    /// The router program to register with. Bound to the receiver's configured router.
    /// CHECK: validated against `config.router`; used only as the CPI target program.
    #[account(address = config.router @ CcipReceiverError::InvalidRouter)]
    pub router_program: UncheckedAccount<'info>,

    /// The router-owned `ReceiverRegistry` PDA, created/updated by the router CPI. Validated by its
    /// PDA derivation under the router (`seeds::program`); `owner` can't be asserted here because on
    /// first registration the router creates it via `init_if_needed`, so it's still System-owned
    /// when this context is checked.
    /// CHECK: address validated by seeds; contents validated by the router.
    #[account(
        mut,
        seeds = [seed::RECEIVER_REGISTRY, &crate::ID.as_ref()],
        bump,
        seeds::program = router_program.key(),
    )]
    pub receiver_registry: UncheckedAccount<'info>,

    /// The router `Config` PDA, validated by the router's `RegisterReceiver` context.
    /// CHECK: validated by the router.
    pub router_config: UncheckedAccount<'info>,

    /// The router's `__event_authority` PDA, forwarded to satisfy the router's `#[event_cpi]` on
    /// `register_receiver` (used for the `ReceiverRegistered` event).
    /// CHECK: validated by the router's event-cpi handling.
    pub router_event_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
