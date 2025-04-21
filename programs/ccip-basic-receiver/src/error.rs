use anchor_lang::prelude::*;

/// Errors that can occur during program execution
#[error_code]
pub enum CCIPReceiverError {
    /// Error when the caller doesn't have permission to execute the function
    #[msg("Caller is not allowed")]
    InvalidCaller,

    /// Error when an unauthorized user attempts to perform a restricted action
    #[msg("Unauthorized access")]
    Unauthorized,

    /// Error when the remaining accounts don't match the expected structure
    #[msg("Invalid remaining accounts structure")]
    InvalidRemainingAccounts,

    /// Error when token account is not owned by specified token program
    #[msg("Token account not owned by specified token program")]
    InvalidTokenAccountOwner,
    
    /// Error when the token admin PDA is invalid
    #[msg("Invalid token admin PDA")]
    InvalidTokenAdmin,
} 