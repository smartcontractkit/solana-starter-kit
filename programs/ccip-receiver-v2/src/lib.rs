//! CCIP 2.0 receiver for the Solana Starter Kit.
//!
//! Implements the CCIP v2 receiver interface so EVM -> Solana messages can opt into
//! Faster-Than-Finality (FTF):
//! - `ccip_receive_v2`: message delivery from the CCIP 2.0 OffRamp
//! - `get_ccvs_and_finality_config`: queried by the OffRamp to learn which CCVs and which
//!   source finality this receiver accepts per source chain
//! - `register_with_router`: registers this program as a v2 receiver in the CCIP Router's
//!   `ReceiverRegistry` (without it the OffRamp treats the program as v1 = finalized only)
//! - `set_ccv_config` / `remove_ccv_config`: owner-managed per-source-chain policy
//!
//! Like ccip-basic-receiver it stores the latest received message and accepts any sender.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    hash::hash,
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};

pub mod error;
pub mod state;

use error::CcipReceiverError;
use state::*;

declare_id!("7pBjzkVarMXGck8qTz1ot4sJrcqmatMernGGRzgcmRaE");

const RECEIVER_VERSION_V2: u8 = 2;

#[program]
pub mod ccip_receiver_v2 {
    use super::*;

    /// Creates the state and message storage PDAs. Restricted to the program's upgrade authority
    /// so nobody can front-run initialization with a malicious router.
    pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
        require_keys_neq!(router, Pubkey::default(), CcipReceiverError::InvalidRouter);
        let state = &mut ctx.accounts.state;
        state.owner = ctx.accounts.authority.key();
        state.router = router;
        state.bump = ctx.bumps.state;

        let storage = &mut ctx.accounts.messages_storage;
        storage.last_updated = Clock::get()?.unix_timestamp;
        storage.message_count = 0;
        storage.latest_message = ReceivedMessage::default();

        msg!("CCIP v2 receiver initialized with router {}", router);
        Ok(())
    }

    /// Called by the CCIP 2.0 OffRamp. Account validation proves the caller is an allowed OffRamp.
    pub fn ccip_receive_v2(ctx: Context<CcipReceiveV2>, message: Any2SVMMessage) -> Result<()> {
        require_gte!(
            MAX_MESSAGE_DATA_SIZE,
            message.data.len(),
            CcipReceiverError::MessageDataTooLarge
        );
        require_gte!(
            MAX_SENDER_ADDRESS_SIZE,
            message.sender.len(),
            CcipReceiverError::SenderTooLarge
        );

        let now = Clock::get()?.unix_timestamp;
        let storage = &mut ctx.accounts.messages_storage;
        storage.last_updated = now;
        storage.message_count = storage.message_count.saturating_add(1);
        storage.latest_message = ReceivedMessage {
            message_id: message.message_id,
            source_chain_selector: message.source_chain_selector,
            sender: message.sender.clone(),
            data: message.data.clone(),
            token_transfer: message.token_transfer.clone(),
            received_timestamp: now,
        };

        emit!(MessageReceived {
            message_id: message.message_id,
            source_chain_selector: message.source_chain_selector,
            sender: message.sender,
            data_length: message.data.len() as u32,
            has_token_transfer: message.token_transfer.is_some(),
        });
        Ok(())
    }

    /// CCIP v2 receiver interface (Solana analog of EVM `getCCVsAndFinalityConfig`).
    /// Returns an empty response (lane default CCVs, full finality) when no config exists.
    pub fn get_ccvs_and_finality_config(
        ctx: Context<GetCcvsAndFinalityConfig>,
        _input: GetReceiverCcvsIn,
    ) -> Result<GetReceiverCcvsOut> {
        let info = &ctx.accounts.source_chain_ccv_config;
        if *info.owner != crate::ID {
            return Ok(GetReceiverCcvsOut::default());
        }
        let data = info.try_borrow_data()?;
        let cfg = SourceChainCcvConfig::try_deserialize(&mut &data[..])?;
        require_eq!(
            cfg.version,
            SOURCE_CHAIN_CCV_CONFIG_V,
            CcipReceiverError::UnsupportedConfigVersion
        );
        Ok(GetReceiverCcvsOut {
            required_ccvs: cfg.required_ccvs,
            optional_ccvs: cfg.optional_ccvs,
            optional_threshold: cfg.optional_threshold,
            allowed_finality_config: cfg.allowed_finality_config,
        })
    }

    /// Sets (or updates) the CCV + finality policy for one source chain.
    pub fn set_ccv_config(ctx: Context<SetCcvConfig>, params: SetCcvConfigParams) -> Result<()> {
        validate_ccv_config(
            &params.required_ccvs,
            &params.optional_ccvs,
            params.optional_threshold,
        )?;
        ctx.accounts
            .source_chain_ccv_config
            .set_inner(SourceChainCcvConfig {
                version: SOURCE_CHAIN_CCV_CONFIG_V,
                bump: ctx.bumps.source_chain_ccv_config,
                required_ccvs: params.required_ccvs,
                optional_ccvs: params.optional_ccvs,
                optional_threshold: params.optional_threshold,
                allowed_finality_config: params.allowed_finality_config,
            });
        msg!(
            "CCV config set for source chain {}: finality flags={} block_depth={}",
            params.source_chain_selector,
            params.allowed_finality_config.flags,
            params.allowed_finality_config.block_depth
        );
        Ok(())
    }

    /// Removes a source chain's policy, reverting it to lane default CCVs + full finality.
    pub fn remove_ccv_config(
        _ctx: Context<RemoveCcvConfig>,
        source_chain_selector: u64,
    ) -> Result<()> {
        msg!("CCV config removed for source chain {}", source_chain_selector);
        Ok(())
    }

    /// Registers this program as a CCIP v2 receiver by CPI-ing the router's `register_receiver`,
    /// signed by this program's registration PDA (proof the receiver itself authorized it).
    pub fn register_with_router(ctx: Context<RegisterWithRouter>) -> Result<()> {
        let router = ctx.accounts.router_program.key();

        let mut data = Vec::with_capacity(8 + 32 + 1);
        data.extend_from_slice(&hash(b"global:register_receiver").to_bytes()[..8]);
        crate::ID.serialize(&mut data)?;
        RECEIVER_VERSION_V2.serialize(&mut data)?;

        // Matches the router's `RegisterReceiver` context (+ #[event_cpi] accounts).
        let signer = ctx.accounts.registration_signer.key();
        let ix = Instruction {
            program_id: router,
            accounts: vec![
                AccountMeta::new(ctx.accounts.receiver_registry.key(), false),
                AccountMeta::new_readonly(ctx.accounts.router_config.key(), false),
                AccountMeta::new_readonly(signer, true), // receiver_registration_signer
                AccountMeta::new_readonly(signer, true), // authority (self-registration)
                AccountMeta::new(ctx.accounts.authority.key(), true), // payer
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.router_event_authority.key(), false),
                AccountMeta::new_readonly(router, false),
            ],
            data,
        };

        invoke_signed(
            &ix,
            &[
                ctx.accounts.receiver_registry.to_account_info(),
                ctx.accounts.router_config.to_account_info(),
                ctx.accounts.registration_signer.to_account_info(),
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.router_event_authority.to_account_info(),
                ctx.accounts.router_program.to_account_info(),
            ],
            &[&[
                RECEIVER_REGISTRATION_SIGNER_SEED,
                router.as_ref(),
                &[ctx.bumps.registration_signer],
            ]],
        )?;
        msg!("Registered {} as a CCIP v2 receiver with router {}", crate::ID, router);
        Ok(())
    }

    pub fn update_router(ctx: Context<OwnerOnly>, new_router: Pubkey) -> Result<()> {
        require_keys_neq!(new_router, Pubkey::default(), CcipReceiverError::InvalidRouter);
        ctx.accounts.state.router = new_router;
        Ok(())
    }

    pub fn get_latest_message(ctx: Context<GetLatestMessage>) -> Result<ReceivedMessage> {
        Ok(ctx.accounts.messages_storage.latest_message.clone())
    }
}

fn validate_ccv_config(
    required_ccvs: &[Pubkey],
    optional_ccvs: &[Pubkey],
    optional_threshold: u8,
) -> Result<()> {
    require_gte!(MAX_CCVS, required_ccvs.len(), CcipReceiverError::TooManyCCVs);
    require_gte!(MAX_CCVS, optional_ccvs.len(), CcipReceiverError::TooManyCCVs);
    for ccv in optional_ccvs {
        require_keys_neq!(
            *ccv,
            Pubkey::default(),
            CcipReceiverError::ZeroPubkeyNotAllowedAsOptional
        );
    }
    let mut seen = std::collections::HashSet::with_capacity(required_ccvs.len() + optional_ccvs.len());
    for ccv in required_ccvs.iter().chain(optional_ccvs.iter()) {
        require!(seen.insert(*ccv), CcipReceiverError::DuplicateCCV);
    }
    if optional_ccvs.is_empty() {
        require_eq!(optional_threshold, 0, CcipReceiverError::InvalidOptionalThreshold);
    } else {
        require_gt!(
            optional_ccvs.len(),
            optional_threshold as usize,
            CcipReceiverError::InvalidOptionalThreshold
        );
    }
    Ok(())
}

#[event]
pub struct MessageReceived {
    pub message_id: [u8; 32],
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
    pub data_length: u32,
    pub has_token_transfer: bool,
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
    #[account(
        init,
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + MessagesStorage::INIT_SPACE,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, crate::program::CcipReceiverV2>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ CcipReceiverError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
}

/// Account order is fixed by the OffRamp: [authority, offramp_program, allowed_offramp, ...]
/// followed by the accounts listed in the message's SVMExecutorArgs (state, messages_storage).
#[derive(Accounts)]
#[instruction(message: Any2SVMMessage)]
pub struct CcipReceiveV2<'info> {
    /// OffRamp CPI signer; only the OffRamp derived from `offramp_program` can sign for it.
    #[account(
        seeds = [EXTERNAL_EXECUTION_CONFIG_SEED, crate::ID.as_ref()],
        bump,
        seeds::program = offramp_program.key(),
    )]
    pub authority: Signer<'info>,

    /// CHECK: only used to derive `authority` and `allowed_offramp`
    pub offramp_program: UncheckedAccount<'info>,

    /// CHECK: router-owned PDA that exists only if `offramp_program` is allowed for this source chain
    #[account(
        owner = state.router @ CcipReceiverError::InvalidCaller,
        seeds = [
            ALLOWED_OFFRAMP_SEED,
            message.source_chain_selector.to_le_bytes().as_ref(),
            offramp_program.key().as_ref()
        ],
        bump,
        seeds::program = state.router,
    )]
    pub allowed_offramp: UncheckedAccount<'info>,

    #[account(seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, BaseState>,

    #[account(mut, seeds = [MESSAGES_STORAGE_SEED], bump)]
    pub messages_storage: Account<'info, MessagesStorage>,
}

#[derive(Accounts)]
#[instruction(input: GetReceiverCcvsIn)]
pub struct GetCcvsAndFinalityConfig<'info> {
    /// CHECK: may be uninitialized; address validated by seeds, ownership checked in the handler
    #[account(seeds = [CCV_CONFIG_SEED, input.source_chain_selector.to_le_bytes().as_ref()], bump)]
    pub source_chain_ccv_config: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(params: SetCcvConfigParams)]
pub struct SetCcvConfig<'info> {
    #[account(seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, BaseState>,
    #[account(
        init_if_needed,
        seeds = [CCV_CONFIG_SEED, params.source_chain_selector.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + SourceChainCcvConfig::INIT_SPACE,
    )]
    pub source_chain_ccv_config: Account<'info, SourceChainCcvConfig>,
    #[account(mut, address = state.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(source_chain_selector: u64)]
pub struct RemoveCcvConfig<'info> {
    #[account(seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, BaseState>,
    #[account(
        mut,
        close = authority,
        seeds = [CCV_CONFIG_SEED, source_chain_selector.to_le_bytes().as_ref()],
        bump = source_chain_ccv_config.bump,
    )]
    pub source_chain_ccv_config: Account<'info, SourceChainCcvConfig>,
    #[account(mut, address = state.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterWithRouter<'info> {
    #[account(seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, BaseState>,

    /// Owner; also pays rent for the router's registry PDA.
    #[account(mut, address = state.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,

    /// CHECK: signer-only PDA of this program; derivation enforced by seeds
    #[account(seeds = [RECEIVER_REGISTRATION_SIGNER_SEED, router_program.key().as_ref()], bump)]
    pub registration_signer: UncheckedAccount<'info>,

    /// CHECK: must be the configured router; used only as the CPI target
    #[account(executable, address = state.router @ CcipReceiverError::InvalidRouter)]
    pub router_program: UncheckedAccount<'info>,

    /// CHECK: router-owned registry PDA (created by the router via init_if_needed)
    #[account(
        mut,
        seeds = [RECEIVER_REGISTRY_SEED, crate::ID.as_ref()],
        bump,
        seeds::program = router_program.key(),
    )]
    pub receiver_registry: UncheckedAccount<'info>,

    /// CHECK: router config PDA; validated by the router
    #[account(seeds = [b"config"], bump, seeds::program = router_program.key())]
    pub router_config: UncheckedAccount<'info>,

    /// CHECK: router's #[event_cpi] authority; validated by the router
    #[account(seeds = [b"__event_authority"], bump, seeds::program = router_program.key())]
    pub router_event_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    #[account(mut, seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, BaseState>,
    #[account(address = state.owner @ CcipReceiverError::OnlyOwner)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetLatestMessage<'info> {
    #[account(seeds = [MESSAGES_STORAGE_SEED], bump)]
    pub messages_storage: Account<'info, MessagesStorage>,
}
