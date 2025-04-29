use anchor_lang::prelude::*;

/// Custom error codes for the CCIP Receiver program
#[error_code]
pub enum CCIPReceiverError {
    /// Error when the caller doesn't have permission to execute the function
    #[msg("Caller is not the configured CCIP router")]
    InvalidCaller,

    /// Error when an unauthorized user attempts to perform a restricted action
    #[msg("Unauthorized: Signer is not the program owner")]
    Unauthorized,

    /// Error when the remaining accounts don't match the expected structure
    #[msg("Invalid remaining accounts structure for token transfer")]
    InvalidRemainingAccounts,

    /// Error when token account is not owned by specified token program
    #[msg("Provided token account owner does not match token program")]
    InvalidTokenAccountOwner,
    
    /// Error when the token admin PDA is invalid
    #[msg("Provided token admin PDA is incorrect")]
    InvalidTokenAdmin,

    /// Error when the message data exceeds the maximum allowed size for this receiver
    #[msg("Message data exceeds the maximum allowed size for this receiver")]
    MessageDataTooLarge,

    /// Error when the number of tokens exceeds the maximum allowed for this receiver
    #[msg("Number of tokens exceeds the maximum allowed for this receiver")]
    TooManyTokens,

    /// Error when the sender address exceeds the maximum allowed size for this receiver
    #[msg("Sender address exceeds the maximum allowed size for this receiver")]
    SenderAddressTooLarge,
} 