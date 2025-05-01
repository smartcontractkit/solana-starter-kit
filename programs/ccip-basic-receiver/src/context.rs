use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::{
    constants::{ALLOWED_OFFRAMP, ANCHOR_DISCRIMINATOR, EXTERNAL_EXECUTION_CONFIG_SEED, MESSAGES_STORAGE_SEED, STATE_SEED, TOKEN_ADMIN_SEED},
    error::CCIPReceiverError,
    state::{
        Any2SVMMessage, BaseState, MessagesStorage, SVMTokenAmount,
        MAX_MESSAGE_DATA_SIZE, MAX_TOKEN_AMOUNTS, MAX_SENDER_ADDRESS_SIZE
    }
};

/// Accounts required for initializing the CCIP Receiver program
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The payer of the transaction, will become the owner
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The state account to be initialized
    #[account(
        init_if_needed,
        payer = payer,
        space = ANCHOR_DISCRIMINATOR + BaseState::INIT_SPACE,
        seeds = [STATE_SEED],
        bump
    )]
    pub state: Account<'info, BaseState>,

    /// Messages storage account to be initialized
    #[account(
        init_if_needed,
        payer = payer,
        space = ANCHOR_DISCRIMINATOR 
              + 8  // last_updated (i64)
              + 8  // message_count (u64)
              // ReceivedMessage struct size breakdown:
              + 32 // message_id ([u8; 32])
              + 1  // message_type (enum)
              + 4 + MAX_MESSAGE_DATA_SIZE // data (Vec<u8> - 4 bytes len + max data)
              + 4 + MAX_TOKEN_AMOUNTS * std::mem::size_of::<SVMTokenAmount>() // token_amounts (Vec<SVMTokenAmount> - 4 bytes len + max items * item size)
              + 8  // received_timestamp (i64)
              + 8  // source_chain_selector (u64)
              + 4 + MAX_SENDER_ADDRESS_SIZE, // sender (Vec<u8> - 4 bytes len + max data)
        seeds = [MESSAGES_STORAGE_SEED],
        bump
    )]
    pub messages_storage: Account<'info, MessagesStorage>,

    /// Token admin PDA that will have authority over all token accounts
    #[account(
        init_if_needed,
        payer = payer,
        space = ANCHOR_DISCRIMINATOR, // Only anchor discriminator needed
        seeds = [TOKEN_ADMIN_SEED],
        bump
    )]
    /// CHECK: This is a PDA used as the authority for all token accounts
    pub token_admin: UncheckedAccount<'info>,

    /// Program state account for verification
    pub system_program: Program<'info, System>,
}

/// Accounts required for receiving a CCIP message
#[derive(Accounts)]
#[instruction(message: Any2SVMMessage)]
pub struct CcipReceive<'info> {
    /// The authority PDA from the offramp program that must sign the transaction
    /// This ensures only authorized offramp programs can call this function
    #[account(
        seeds = [EXTERNAL_EXECUTION_CONFIG_SEED, crate::ID.as_ref()],
        bump,
        seeds::program = offramp_program.key(),
    )]
    pub authority: Signer<'info>,

    /// The offramp program account
    /// Used for deriving PDA seeds
    /// CHECK: offramp program: exists only to derive the allowed offramp PDA and the authority PDA
    pub offramp_program: UncheckedAccount<'info>,

    /// PDA from the router program that verifies this offramp is allowed
    /// If this PDA doesn't exist, the router doesn't allow this offramp
    /// CHECK: PDA of the router program verifying the signer is an allowed offramp
    #[account(
        owner = state.router @ CCIPReceiverError::InvalidCaller, // this guarantees that it was initialized
        seeds = [
            ALLOWED_OFFRAMP,
            message.source_chain_selector.to_le_bytes().as_ref(),
            offramp_program.key().as_ref()
        ],
        bump,
        seeds::program = state.router,
    )]
    pub allowed_offramp: UncheckedAccount<'info>,

    /// Program state account for verification
    #[account(
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: Account<'info, BaseState>,

    /// Storage for received messages
    /// Will be updated with the latest message
    #[account(
        mut,
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,

    // Note: Token-related accounts are dynamically provided in remaining_accounts
}

/// Accounts required for retrieving the latest message
#[derive(Accounts)]
pub struct GetLatestMessage<'info> {
    /// The messages storage account to read from
    #[account(
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,
}

/// Accounts required for withdrawing tokens
#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    /// Program state account for verification
    #[account(
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: Account<'info, BaseState>,

    /// The token account owned by the program
    #[account(
        mut,
        token::mint = mint,
        token::authority = token_admin,
        token::token_program = token_program,
    )]
    pub program_token_account: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,

    /// The destination token account
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub to_token_account: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,

    /// The token mint
    pub mint: InterfaceAccount<'info, Mint>,

    /// The token program
    #[account(address = *mint.to_account_info().owner)]
    /// CHECK: CPI to token program
    pub token_program: AccountInfo<'info>,

    /// The token admin PDA that has authority over program token accounts
    #[account(
        seeds = [TOKEN_ADMIN_SEED],
        bump,
    )]
    /// CHECK: CPI signer for tokens
    pub token_admin: UncheckedAccount<'info>,

    /// The authority (owner) of the program
    #[account(
        address = state.owner @ CCIPReceiverError::Unauthorized,
    )]
    pub authority: Signer<'info>,
}

/// Accounts required for closing the messages storage account
#[derive(Accounts)]
pub struct CloseStorage<'info> {
    /// Program state account for owner verification and closing
    #[account(
        mut,
        seeds = [STATE_SEED],
        bump,
        close = owner // Anchor handles closing and sending lamports to owner
    )]
    pub state: Account<'info, BaseState>,

    /// The messages storage account to close
    #[account(
        mut,
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
        close = owner // Anchor handles closing and sending lamports to owner
    )]
    pub messages_storage: Account<'info, MessagesStorage>,

    /// The owner who will receive the rent lamports from the closed account
    #[account(
        mut,
        address = state.owner @ CCIPReceiverError::Unauthorized
    )]
    pub owner: Signer<'info>,
    
    /// System program needed for closing accounts
    pub system_program: Program<'info, System>,
} 