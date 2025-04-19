use anchor_lang::prelude::*;

/// Errors that can occur during program execution
#[error_code]
pub enum CCIPReceiverError {
    /// Error when a non-router address attempts to call router-restricted functions
    #[msg("Address is not router external execution PDA")]
    OnlyRouter,

    /// Error when an invalid router address is provided
    #[msg("Invalid router address")]
    InvalidRouter,

    /// Error when the source chain and sender combination is not allowed
    #[msg("Invalid combination of chain and sender")]
    InvalidChainAndSender,

    /// Error when a non-owner address tries to perform an owner-only operation
    #[msg("Address is not owner")]
    OnlyOwner,

    /// Error when the caller doesn't have permission to execute the function
    #[msg("Caller is not allowed")]
    InvalidCaller,

    /// Error when an invalid address is proposed as the new owner
    #[msg("Proposed owner is invalid")]
    InvalidProposedOwner,

    /// Error when an arithmetic overflow occurs during computation
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,

    /// Error when an arithmetic underflow occurs during computation
    #[msg("Arithmetic underflow occurred")]
    ArithmeticUnderflow,

    /// Error when a withdrawal amount exceeds the available balance
    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,

    /// Error when the token mint doesn't match the expected token in metadata
    #[msg("Token mint mismatch with metadata")]
    TokenMismatch,

    /// Error when the remaining accounts don't match the expected structure
    #[msg("Invalid remaining accounts structure")]
    InvalidRemainingAccounts,

    /// Error when account validation fails
    #[msg("Account validation failed")]
    AccountValidationFailed,
    
    /// Error when an unauthorized user attempts to perform a restricted action
    #[msg("Unauthorized access")]
    Unauthorized,
} 