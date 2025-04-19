use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use crate::{
    constants::TOKEN_VAULT_SEED,
    context::CcipReceive,
    error::CCIPReceiverError,
    events::{MessageReceived, TokenReceived, TokensForwarded},
    state::{Any2SVMMessage, MessageType, ReceivedMessage},
};

/// Process an incoming cross-chain message
/// 
/// This function is called by the CCIP Router to handle incoming cross-chain messages.
/// It processes message data and forwards tokens to recipient accounts dynamically using remaining_accounts.
///
/// For the tutorial, the remaining_accounts should contain these accounts in order:
/// 1. token_mint: Account<Mint>
/// 2. token_vault: Account<TokenAccount>
/// 3. token_vault_authority: UncheckedAccount
/// 4. recipient_token_account: Account<TokenAccount>
/// 5. token_program: Program<Token>
///
/// # Arguments
/// * `ctx` - The context of accounts involved in this instruction
/// * `message` - The cross-chain message containing data and token information
/// * `token_amount` - The amount of token received in this transaction
pub fn handler(
    ctx: Context<CcipReceive>,
    message: Any2SVMMessage,
    token_amount: u64
) -> Result<()> {
    // Emit detailed message received event
    emit!(MessageReceived {
        message_id: message.message_id,
        source_chain_selector: message.source_chain_selector,
        sender: message.sender.clone(),
        data_length: message.data.len() as u64,
        token_count: message.token_amounts.len() as u8,
    });
    
    // Get a mutable reference to the messages storage account
    let messages_storage = &mut ctx.accounts.messages_storage;

    // Determine the type of message based on its contents
    let message_type = if !message.data.is_empty() && message.token_amounts.len() > 0 {
        MessageType::ProgrammaticTokenTransfer
    } else if !message.data.is_empty() {
        MessageType::ArbitraryMessaging
    } else {
        MessageType::TokenTransfer
    };
    
    // Process token transfer if tokens are involved
    if token_amount > 0 && 
        (message_type == MessageType::TokenTransfer || 
         message_type == MessageType::ProgrammaticTokenTransfer) {
        
        // For the tutorial demonstration, we validate the remaining_accounts structure
        // In a production environment, more robust validation would be implemented
        if ctx.remaining_accounts.len() != 5 {
            return Err(CCIPReceiverError::InvalidRemainingAccounts.into());
        }
        
        // Extract account references from the remaining_accounts
        // This demonstrates dynamic account handling in Solana programs
        let token_mint_info = &ctx.remaining_accounts[0];
        let token_vault_info = &ctx.remaining_accounts[1];
        let token_vault_authority_info = &ctx.remaining_accounts[2];
        let recipient_account_info = &ctx.remaining_accounts[3];
        let token_program_info = &ctx.remaining_accounts[4];
        
        // Get the token mint key for events
        let token_mint_key = token_mint_info.key();
        
        // Emit token received event
        emit!(TokenReceived {
            token: token_mint_key,
            amount: token_amount,
            index: 0,
        });
        
        // In a real production environment, additional validation would be performed here
        // For example, validating that:
        // 1. The token_mint matches what's expected for the source chain
        // 2. The token_vault is the correct vault for this mint
        // 3. The recipient account is owned by the expected program and configured for the mint
        
        // Create the token transfer instruction
        let transfer_ix = Transfer {
            from: token_vault_info.clone(),
            to: recipient_account_info.clone(),
            authority: token_vault_authority_info.clone(),
        };
        
        // Create the CPI (Cross-Program Invocation) context
        let cpi_ctx = CpiContext::new(
            token_program_info.clone(),
            transfer_ix,
        );
        
        // Derive the PDA signer seeds for the token vault authority
        let vault_bump = Pubkey::find_program_address(&[TOKEN_VAULT_SEED], &crate::ID).1;
        let seeds = &[TOKEN_VAULT_SEED, &[vault_bump]];
        let signer_seeds = &[&seeds[..]];
        
        // Execute the token transfer with the PDA as signer
        token::transfer(cpi_ctx.with_signer(signer_seeds), token_amount)?;
        
        // Emit the tokens forwarded event
        emit!(TokensForwarded {
            token: token_mint_key,
            amount: token_amount,
            recipient: recipient_account_info.key(),
        });
    }
    
    // Create and store the latest received message in our storage account
    messages_storage.latest_message = ReceivedMessage {
        message_id: message.message_id,
        message_type,
        data: message.data.clone(),
        token_amounts: message.token_amounts.clone(),
        received_timestamp: Clock::get()?.unix_timestamp,
        source_chain_selector: message.source_chain_selector,
        sender: message.sender.clone(),
    };

    // Update the storage metadata
    messages_storage.message_count += 1;
    messages_storage.last_updated = Clock::get()?.unix_timestamp;

    // Tutorial benefit: you can do additional processing here based on the message
    // For example, you could:
    // 1. Swap the received tokens
    // 2. Add liquidity to a pool
    // 3. Execute a custom action based on message.data
    // 4. Update application state

    Ok(())
} 