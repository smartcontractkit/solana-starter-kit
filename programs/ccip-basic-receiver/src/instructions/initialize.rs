use anchor_lang::prelude::*;
use crate::{
    context::Initialize,
    events::ReceiverInitialized,
    state::ReceivedMessage,
};

/// Initialize the CCIP Receiver program
/// 
/// Creates and initializes the state and messages storage PDAs.
/// Also initializes the token admin PDA which will have authority over all token accounts.
///
/// # Arguments
/// * `ctx` - The context for this instruction
/// * `router` - The public key of the CCIP Router program
pub fn handler(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
    let state = &mut ctx.accounts.state;
    let messages_storage = &mut ctx.accounts.messages_storage;
    
    // Initialize program state
    state.owner = ctx.accounts.payer.key();
    state.router = router;
    
    // Initialize messages storage
    messages_storage.last_updated = Clock::get()?.unix_timestamp;
    messages_storage.message_count = 0;
    messages_storage.latest_message = ReceivedMessage::default();
    
    // Note: token_admin PDA is initialized via the account constraints
    
    // Emit initialization event
    emit!(ReceiverInitialized {
        router,
        owner: ctx.accounts.payer.key(),
    });
    
    msg!("CCIP Receiver program initialized with router: {}", router);
    
    Ok(())
} 