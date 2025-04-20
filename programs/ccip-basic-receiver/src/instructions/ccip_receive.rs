use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_2022::spl_token_2022;
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
pub fn handler(
    ctx: Context<CcipReceive>,
    message: Any2SVMMessage,
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
    if message.token_amounts.len() > 0 && 
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
        
        // Validate token accounts against provided token program
        if *token_vault_info.owner != token_program_info.key() {
            return Err(CCIPReceiverError::InvalidTokenAccountOwner.into());
        }
        
        if *recipient_account_info.owner != token_program_info.key() {
            return Err(CCIPReceiverError::InvalidTokenAccountOwner.into());
        }
        
        // Get the token mint key for events
        let token_mint_key = token_mint_info.key();
        
        // Get token amount from the message
        let token_amount = message.token_amounts.first()
            .map(|token| token.amount)
            .unwrap_or(0);
        
        // Only proceed if there's an actual token amount to transfer
        if token_amount > 0 {
            // Emit token received event
            emit!(TokenReceived {
                token: token_mint_key,
                amount: token_amount,
                index: 0,
            });
            
            // Build transfer instruction using token-2022 layout
            let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
                &spl_token_2022::ID, // Use Token-2022 to build instruction structure
                &token_vault_info.key(),
                &token_mint_info.key(),
                &recipient_account_info.key(),
                &token_vault_authority_info.key(),
                &[],
                token_amount,
                0, // Expected decimals, we rely on the check done by the token program
            )?;
            
            // Replace with actual token program
            transfer_ix.program_id = token_program_info.key();
            
            // Derive the PDA signer seeds for the token vault authority
            let vault_bump = Pubkey::find_program_address(&[TOKEN_VAULT_SEED], &crate::ID).1;
            let seeds = &[TOKEN_VAULT_SEED, &[vault_bump]];
            let signer_seeds = &[&seeds[..]];
            
            // Execute the token transfer with the PDA as signer
            invoke_signed(
                &transfer_ix,
                &[
                    token_vault_info.clone(),
                    recipient_account_info.clone(),
                    token_vault_authority_info.clone(),
                ],
                signer_seeds,
            )?;
            
            // Emit the tokens forwarded event
            emit!(TokensForwarded {
                token: token_mint_key,
                amount: token_amount,
                recipient: recipient_account_info.key(),
            });
        }
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

    Ok(())
} 