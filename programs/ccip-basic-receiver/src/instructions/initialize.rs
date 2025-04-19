use anchor_lang::prelude::*;
use crate::{
    context::Initialize,
    events::ReceiverInitialized,
};

/// Initialize the receiver program state
/// 
/// This function initializes the state for the CCIP Receiver program
/// by setting the owner and router. It must be called before any other
/// function can be used.
///
/// # Arguments
/// * `ctx` - The context of accounts for this instruction
/// * `router` - The public key of the CCIP Router program
pub fn handler(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    // Initialize program state
    state.owner = ctx.accounts.payer.key();
    state.router = router;
    
    // Emit initialization event
    emit!(ReceiverInitialized {
        router,
        owner: ctx.accounts.payer.key(),
    });
    
    Ok(())
} 