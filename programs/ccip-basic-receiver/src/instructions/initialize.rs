use anchor_lang::prelude::*;
use crate::{
    constants::{EXTERNAL_EXECUTION_CONFIG_SEED, MESSAGES_STORAGE_SEED, MAX_MESSAGE_SIZE, STATE_SEED},
    events::ReceiverInitialized,
    state::{BaseState, ExternalExecutionConfig, MessagesStorage},
};

/// Accounts required for the initialize instruction
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The program state account that will be initialized
    /// This PDA stores owner and router information
    #[account(
        init,
        seeds = [STATE_SEED],
        bump,
        payer = authority,
        space = 8 + BaseState::INIT_SPACE,
    )]
    pub state: Account<'info, BaseState>,

    /// Storage account for received messages
    /// This PDA will store the latest received message and tracking metadata
    #[account(
        init,
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
        payer = authority,
        space = 8 + 8 + 8 + MAX_MESSAGE_SIZE, // last_updated + message_count + latest_message
    )]
    pub messages_storage: Account<'info, MessagesStorage>,

    /// External execution configuration
    /// This PDA is used for router authorization
    #[account(
        init,
        seeds = [EXTERNAL_EXECUTION_CONFIG_SEED],
        bump,
        payer = authority,
        space = 8 + ExternalExecutionConfig::INIT_SPACE,
    )]
    pub external_execution_config: Account<'info, ExternalExecutionConfig>,

    /// The authority (signer) initializing the program 
    /// This account pays for the initialization of all PDAs
    #[account(mut)]
    pub authority: Signer<'info>,

    /// System program reference
    pub system_program: Program<'info, System>,
}

/// Initialize the receiver program state
/// 
/// This function sets up the core program state and initializes storage for received messages.
/// It should be called once before the program can be used.
///
/// # Arguments
/// * `ctx` - The context of accounts involved in this instruction
/// * `router` - The CCIP router program ID that will be authorized to call this program
pub fn initialize_handler(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
    // Emit initialization event
    emit!(ReceiverInitialized {
        owner: ctx.accounts.authority.key(),
        router,
    });

    // Initialize state account
    let state = &mut ctx.accounts.state;
    state.owner = ctx.accounts.authority.key();
    state.router = router;

    // Initialize messages storage
    let messages_storage = &mut ctx.accounts.messages_storage;
    messages_storage.last_updated = Clock::get()?.unix_timestamp;
    messages_storage.message_count = 0;
    // The latest_message field will be initialized with default values

    Ok(())
} 