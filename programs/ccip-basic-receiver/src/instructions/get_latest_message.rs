use anchor_lang::prelude::*;
use crate::{
    context::GetLatestMessage,
    state::ReceivedMessage,
};

/// Get the latest received message
/// 
/// This function returns the latest cross-chain message received by the program.
/// It's a read-only operation that doesn't modify any state.
///
/// # Arguments
/// * `ctx` - The context of accounts for this instruction
/// 
/// # Returns
/// * `ReceivedMessage` - The latest message received by the program
pub fn handler(ctx: Context<GetLatestMessage>) -> Result<ReceivedMessage> {
    // Return the latest message from storage
    Ok(ctx.accounts.messages_storage.latest_message.clone())
} 