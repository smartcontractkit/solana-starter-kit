use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token_2022::spl_token_2022;
use anchor_spl::token_2022::spl_token_2022::state::Mint;
use anchor_lang::solana_program::program_pack::Pack;
use crate::{
    constants::TOKEN_ADMIN_SEED,
    context::CcipReceive,
    error::CCIPReceiverError,
    events::{MessageReceived, TokenReceived, TokensForwarded},
    state::{
        Any2SVMMessage, MessageType, ReceivedMessage,
        MAX_MESSAGE_DATA_SIZE, MAX_TOKEN_AMOUNTS, MAX_SENDER_ADDRESS_SIZE
    },
};

/// Process an incoming cross-chain message
/// 
/// This function is called by the CCIP Router to handle incoming cross-chain messages.
/// It processes message data and forwards tokens to recipient accounts dynamically using remaining_accounts.
///
/// For token transfers, the remaining_accounts should contain these accounts in order:
/// 1. token_mint: Account<Mint>
/// 2. source_token_account: Account<TokenAccount> (owned by program with token_admin authority)
/// 3. token_admin: UncheckedAccount (the PDA with authority)
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
    // --- Input Validation ---
    // Validate data size against the maximum allowed
    if message.data.len() > MAX_MESSAGE_DATA_SIZE {
        msg!("Error: Message data size ({}) exceeds maximum allowed ({})", 
             message.data.len(), MAX_MESSAGE_DATA_SIZE);
        return Err(CCIPReceiverError::MessageDataTooLarge.into());
    }
    // Validate token count against the maximum allowed
    if message.token_amounts.len() > MAX_TOKEN_AMOUNTS {
        msg!("Error: Number of token transfers ({}) exceeds maximum allowed ({})", 
             message.token_amounts.len(), MAX_TOKEN_AMOUNTS);
        return Err(CCIPReceiverError::TooManyTokens.into());
    }
    // Validate sender address size against the maximum allowed
    if message.sender.len() > MAX_SENDER_ADDRESS_SIZE {
        msg!("Error: Sender address size ({}) exceeds maximum allowed ({})", 
             message.sender.len(), MAX_SENDER_ADDRESS_SIZE);
        return Err(CCIPReceiverError::SenderAddressTooLarge.into());
    }
    // --- End Input Validation ---

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
    if message.token_amounts.len() > 0 {
        // Validate the remaining_accounts structure
        if ctx.remaining_accounts.len() < 5 {
            return Err(CCIPReceiverError::InvalidRemainingAccounts.into());
        }
        
        // Extract account references from the remaining_accounts
        let token_mint_info = &ctx.remaining_accounts[0];
        let source_token_account = &ctx.remaining_accounts[1];
        let token_admin_info = &ctx.remaining_accounts[2];
        let recipient_account_info = &ctx.remaining_accounts[3];
        let token_program_info = &ctx.remaining_accounts[4];
        
        // Verify the token_admin is the expected PDA
        let (expected_token_admin, admin_bump) = 
            Pubkey::find_program_address(&[TOKEN_ADMIN_SEED], &crate::ID);
        if token_admin_info.key() != expected_token_admin {
            return Err(CCIPReceiverError::InvalidTokenAdmin.into());
        }
        
        // Validate token accounts against provided token program
        if source_token_account.owner != token_program_info.key {
            return Err(CCIPReceiverError::InvalidTokenAccountOwner.into());
        }
        
        if recipient_account_info.owner != token_program_info.key {
            return Err(CCIPReceiverError::InvalidTokenAccountOwner.into());
        }
        
        // Get the token mint key for events
        let token_mint_key = token_mint_info.key();
        
        // For simplicity, this implementation only processes the first token in the array
        // To support multiple tokens, you would need to iterate through token_amounts and handle each one
        let token_amount = message.token_amounts.first()
            .map(|token| token.amount)
            .unwrap_or(0);
        
        // Emit token received event
        emit!(TokenReceived {
            token: token_mint_key,
            amount: token_amount,
            index: 0,
        });
        
        // Build transfer instruction using token-2022 layout
        // Unpack the mint data to get decimals
        let mint_data = Mint::unpack(*token_mint_info.try_borrow_data()?)?;
        let decimals = mint_data.decimals;
        
        let mut transfer_ix = spl_token_2022::instruction::transfer_checked(
            &spl_token_2022::ID, // Use Token-2022 to build instruction structure
            &source_token_account.key(),
            &token_mint_info.key(),
            &recipient_account_info.key(),
            &token_admin_info.key(),
            &[],
            token_amount,
            decimals, // Use actual decimals from the mint
        )?;
        
        // Replace with actual token program
        transfer_ix.program_id = token_program_info.key();
        
        // Derive the PDA signer seeds for the token admin
        let seeds = &[TOKEN_ADMIN_SEED, &[admin_bump]];
        let signer_seeds = &[&seeds[..]];
        
        // Execute the token transfer with the PDA as signer
        invoke_signed(
            &transfer_ix,
            &[
                source_token_account.clone(),
                token_mint_info.clone(),
                recipient_account_info.clone(),
                token_admin_info.clone(),
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