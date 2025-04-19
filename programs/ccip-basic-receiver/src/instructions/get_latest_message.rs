use anchor_lang::prelude::*;
use crate::{
    constants::MESSAGES_STORAGE_SEED,
    state::{MessagesStorage, ReceivedMessage},
};

/// Accounts required for getting the latest received message
#[derive(Accounts)]
pub struct GetLatestMessage<'info> {
    /// Storage account containing received messages
    #[account(
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,
}

/// Get the latest received cross-chain message
/// 
/// This view function returns the most recent message received by the program.
/// Useful for integrations to check received data without having to scan events.
///
/// # Arguments
/// * `ctx` - The context of accounts involved in this instruction
///
/// # Returns
/// * `ReceivedMessage` - The most recent message received by the program
pub fn get_latest_message_handler(ctx: Context<GetLatestMessage>) -> Result<ReceivedMessage> {
    // Simply return a clone of the latest message from storage
    let messages_storage = &ctx.accounts.messages_storage;
    Ok(messages_storage.latest_message.clone())
} 