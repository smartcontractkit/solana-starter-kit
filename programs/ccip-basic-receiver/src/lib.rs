use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use std::ops::Deref;

declare_id!("671b2A65jR5QxwYFSuEMBhQ6bWJKkGMheEp3ReWC9WnB");

pub const EXTERNAL_EXECUTION_CONFIG_SEED: &[u8] = b"external_execution_config";
pub const ALLOWED_OFFRAMP: &[u8] = b"allowed_offramp";
pub const STATE_SEED: &[u8] = b"state";
pub const MESSAGES_STORAGE_SEED: &[u8] = b"messages_storage";
pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";
pub const TOKEN_METADATA_SEED: &[u8] = b"token_metadata";

/// CCIP Receiver program that accepts cross-chain messages from any sender.
/// This program is a simplified version that logs received message data and doesn't check sender approval.
#[program]
pub mod ccip_basic_receiver {
    use super::*;

    /// Initialize the receiver program state
    /// @param router - The CCIP router program ID
    pub fn initialize(ctx: Context<Initialize>, router: Pubkey) -> Result<()> {
        emit!(ReceiverInitialized {
            owner: ctx.accounts.authority.key(),
            router,
        });

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

    /// Initialize a token vault for a specific token mint
    /// This vault will be used to receive tokens from cross-chain transfers
    pub fn initialize_token_vault(ctx: Context<InitializeTokenVault>) -> Result<()> {
        // Initialize token vault metadata to track balance
        let token_metadata = &mut ctx.accounts.token_metadata;
        token_metadata.mint = ctx.accounts.token_mint.key();
        token_metadata.balance = 0;
        token_metadata.total_received = 0;
        token_metadata.total_withdrawn = 0;
        token_metadata.last_updated = Clock::get()?.unix_timestamp;

        emit!(TokenVaultInitialized {
            token_mint: ctx.accounts.token_mint.key(),
            token_vault: ctx.accounts.token_vault.key(),
        });

        Ok(())
    }

    /// This function is called by the CCIP Router to handle incoming cross-chain messages.
    /// It receives message data, updates token metadata, and immediately forwards tokens
    /// to the specified recipient account.
    ///
    /// @param message - The cross-chain message from the source chain
    /// @param token_amount - The amount of tokens received in this transaction
    pub fn ccip_receive(
        ctx: Context<CcipReceive>, 
        message: Any2SVMMessage,
        token_amount: u64
    ) -> Result<()> {
        // Emit detailed message event
        emit!(MessageReceived {
            message_id: message.message_id,
            source_chain_selector: message.source_chain_selector,
            sender: message.sender.clone(),
            data_length: message.data.len() as u64,
            token_count: message.token_amounts.len() as u8,
        });

        // Store the message in the messages storage PDA
        let messages_storage = &mut ctx.accounts.messages_storage;

        // Determine message type
        let message_type = if !message.data.is_empty() && message.token_amounts.len() > 0 {
            MessageType::ProgrammaticTokenTransfer
        } else if !message.data.is_empty() {
            MessageType::ArbitraryMessaging
        } else {
            MessageType::TokenTransfer
        };

        // Only process token transfers if tokens are involved
        if token_amount > 0 && (message_type == MessageType::TokenTransfer || 
                               message_type == MessageType::ProgrammaticTokenTransfer) {
            // Emit token received event at the appropriate place
            emit!(TokenReceived {
                token: ctx.accounts.token_mint.key(),
                amount: token_amount,
                index: 0, // For simplicity in the tutorial, we handle one token at a time
            });

            // Update token metadata to reflect the received tokens
            let token_metadata = &mut ctx.accounts.token_metadata;
            
            // Update only total_received as the tokens will be forwarded immediately
            token_metadata.total_received = token_metadata.total_received.checked_add(token_amount)
                .ok_or(CCIPReceiverError::ArithmeticOverflow)?;
            token_metadata.last_updated = Clock::get()?.unix_timestamp;
            
            // Forward tokens from the token vault to the recipient
            let transfer_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.token_vault_authority.to_account_info(),
                },
            );

            // Get the bump from ctx.bumps
            let vault_bump = ctx.bumps.token_vault_authority;
            let seeds = &[TOKEN_VAULT_SEED, &[vault_bump]];
            let signer_seeds = &[&seeds[..]];

            // Execute the transfer instruction with PDA as signer
            token::transfer(transfer_ctx.with_signer(signer_seeds), token_amount)?;

            // Emit event for the forwarded tokens
            emit!(TokensForwarded {
                token: ctx.accounts.token_mint.key(),
                amount: token_amount,
                recipient: ctx.accounts.recipient_token_account.key(),
            });
        }
        
        // Create and store the latest received message
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

    /// Get the latest received message
    pub fn get_latest_message(ctx: Context<GetLatestMessage>) -> Result<ReceivedMessage> {
        let messages_storage = &ctx.accounts.messages_storage;

        // Return the latest message
        Ok(messages_storage.latest_message.clone())
    }
    
    /// Get token vault balance information
    pub fn get_token_balance(ctx: Context<GetTokenBalance>) -> Result<TokenBalanceInfo> {
        let token_metadata = &ctx.accounts.token_metadata;
        
        Ok(TokenBalanceInfo {
            mint: token_metadata.mint,
            balance: token_metadata.balance,
            total_received: token_metadata.total_received,
            total_withdrawn: token_metadata.total_withdrawn,
            last_updated: token_metadata.last_updated,
        })
    }
}

const ANCHOR_DISCRIMINATOR: usize = 8;
const MAX_MESSAGE_SIZE: usize = 1000; // Adjust based on your expected message size

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [STATE_SEED],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + BaseState::INIT_SPACE,
    )]
    pub state: Account<'info, BaseState>,

    #[account(
        init,
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + 8 + 8 + MAX_MESSAGE_SIZE, // last_updated + message_count + latest_message
    )]
    pub messages_storage: Account<'info, MessagesStorage>,

    #[account(
        init,
        seeds = [EXTERNAL_EXECUTION_CONFIG_SEED],
        bump,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + ExternalExecutionConfig::INIT_SPACE,
    )]
    pub external_execution_config: Account<'info, ExternalExecutionConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(message: Any2SVMMessage, token_amount: u64)]
pub struct CcipReceive<'info> {
    // Offramp CPI signer PDA must be first
    // It is not mutable, and thus cannot be used as payer of init/realloc of other PDAs.
    #[account(
        seeds = [EXTERNAL_EXECUTION_CONFIG_SEED, crate::ID.as_ref()],
        bump,
        seeds::program = offramp_program.key(),
    )]
    pub authority: Signer<'info>,

    /// CHECK offramp program: exists only to derive the allowed offramp PDA
    /// and the authority PDA. Must be second.
    pub offramp_program: UncheckedAccount<'info>,

    // PDA to verify that calling offramp is valid
    /// CHECK PDA of the router program verifying the signer is an allowed offramp.
    /// If PDA does not exist, the router doesn't allow this offramp
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

    // Program state for validation
    #[account(
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: Account<'info, BaseState>,

    // Message storage
    #[account(
        mut,
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,

    // Token vault accounts for the received token
    pub token_mint: Account<'info, Mint>,

    // Token metadata for tracking balances
    #[account(
        mut,
        seeds = [TOKEN_METADATA_SEED, token_mint.key().as_ref()],
        bump,
        constraint = token_metadata.mint == token_mint.key() @ CCIPReceiverError::TokenMismatch,
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    // Token vault that should have received the tokens already
    #[account(
        mut,
        seeds = [TOKEN_VAULT_SEED, token_mint.key().as_ref()],
        bump,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: This is the PDA that has authority over the token vault
    #[account(
        seeds = [TOKEN_VAULT_SEED],
        bump,
    )]
    pub token_vault_authority: UncheckedAccount<'info>,

    // Destination account to receive tokens
    #[account(
        mut,
        token::mint = token_mint,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    // Token program for transfer operation
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeTokenVault<'info> {
    #[account(
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: Account<'info, BaseState>,

    #[account(
        mut,
        address = state.owner @ CCIPReceiverError::OnlyOwner,
    )]
    pub authority: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    // Initialize metadata PDA to track token balances
    #[account(
        init,
        payer = authority,
        seeds = [TOKEN_METADATA_SEED, token_mint.key().as_ref()],
        bump,
        space = ANCHOR_DISCRIMINATOR + TokenMetadata::INIT_SPACE,
    )]
    pub token_metadata: Account<'info, TokenMetadata>,

    #[account(
        init,
        payer = authority,
        seeds = [TOKEN_VAULT_SEED, token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = token_vault_authority,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: This is the PDA that will have authority over the token vault
    #[account(
        seeds = [TOKEN_VAULT_SEED],
        bump,
    )]
    pub token_vault_authority: UncheckedAccount<'info>,

    /// Using standard token program
    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct GetLatestMessage<'info> {
    #[account(
        seeds = [MESSAGES_STORAGE_SEED],
        bump,
    )]
    pub messages_storage: Account<'info, MessagesStorage>,
}

#[derive(Accounts)]
pub struct GetTokenBalance<'info> {
    #[account(
        seeds = [TOKEN_METADATA_SEED, token_metadata.mint.as_ref()],
        bump,
    )]
    pub token_metadata: Account<'info, TokenMetadata>,
}

// BaseState contains the state for core safety checks
#[account]
#[derive(InitSpace, Default, Debug)]
pub struct BaseState {
    pub owner: Pubkey,
    pub router: Pubkey,
}

// Storage for the latest received message
#[account]
#[derive(Debug)]
pub struct MessagesStorage {
    pub last_updated: i64,
    pub message_count: u64,
    pub latest_message: ReceivedMessage,
}

// Token metadata for balance tracking
#[account]
#[derive(InitSpace, Debug)]
pub struct TokenMetadata {
    pub mint: Pubkey,
    pub balance: u64,
    pub total_received: u64,
    pub total_withdrawn: u64,
    pub last_updated: i64,
}

// Public response type for token balance query
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenBalanceInfo {
    pub mint: Pubkey,
    pub balance: u64,
    pub total_received: u64,
    pub total_withdrawn: u64,
    pub last_updated: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default, PartialEq)]
pub enum MessageType {
    #[default]
    TokenTransfer,             // Only token transfer, no data
    ArbitraryMessaging,        // Only data, no token transfer
    ProgrammaticTokenTransfer, // Both data and token transfer
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct ReceivedMessage {
    pub message_id: [u8; 32],
    pub message_type: MessageType,
    pub data: Vec<u8>,
    pub token_amounts: Vec<SVMTokenAmount>,
    pub received_timestamp: i64,
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
}

#[account]
#[derive(InitSpace, Debug, Default)]
pub struct ExternalExecutionConfig {}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Any2SVMMessage {
    pub message_id: [u8; 32],
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
    pub data: Vec<u8>,
    pub token_amounts: Vec<SVMTokenAmount>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SVMTokenAmount {
    pub token: Pubkey,
    pub amount: u64, // solana local token amount
}

#[error_code]
pub enum CCIPReceiverError {
    #[msg("Address is not router external execution PDA")]
    OnlyRouter,
    #[msg("Invalid router address")]
    InvalidRouter,
    #[msg("Invalid combination of chain and sender")]
    InvalidChainAndSender,
    #[msg("Address is not owner")]
    OnlyOwner,
    #[msg("Caller is not allowed")]
    InvalidCaller,
    #[msg("Proposed owner is invalid")]
    InvalidProposedOwner,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("Arithmetic underflow occurred")]
    ArithmeticUnderflow,
    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,
    #[msg("Token mint mismatch with metadata")]
    TokenMismatch,
}

#[event]
pub struct ReceiverInitialized {
    pub owner: Pubkey,
    pub router: Pubkey,
}

#[event]
pub struct MessageReceived {
    pub message_id: [u8; 32],
    pub source_chain_selector: u64,
    pub sender: Vec<u8>,
    pub data_length: u64,
    pub token_count: u8,
}

#[event]
pub struct TokenReceived {
    pub token: Pubkey,
    pub amount: u64,
    pub index: u8,
}

#[event]
pub struct TokenVaultInitialized {
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
}

#[event]
pub struct TokensForwarded {
    pub token: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
}
