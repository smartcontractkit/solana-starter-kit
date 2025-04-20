use anchor_lang::prelude::*;
use crate::{
    context::Initialize,
    events::ReceiverInitialized,
    state::ReceivedMessage,
};

/// Initialize the receiver program state
/// 
/// This function initializes the state for the CCIP Receiver program
/// by setting the owner and router. It also initializes the messages_storage account.
/// It must be called before any other function can be used.
///
/// # Arguments
/// * `ctx` - The context of accounts for this instruction
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
    
    // Emit initialization event
    emit!(ReceiverInitialized {
        router,
        owner: ctx.accounts.payer.key(),
    });
    
    Ok(())
} 