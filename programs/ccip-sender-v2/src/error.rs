use anchor_lang::prelude::*;

#[error_code]
pub enum SenderError {
    #[msg("Invalid router address")]
    InvalidRouter,
    #[msg("Address is not owner")]
    OnlyOwner,
    #[msg("Address is not proposed_owner")]
    OnlyProposedOwner,
    #[msg("Proposed owner is invalid")]
    InvalidProposedOwner,
    #[msg("The forwarded router account list is malformed")]
    InvalidForwardedAccounts,
    #[msg("The source token account is not the caller's associated token account")]
    InvalidSourceTokenAccount,
    #[msg("The fee token account is not the caller's associated token account")]
    InvalidFeeTokenAccount,
    #[msg("The token account is not the ccip_sender PDA's associated token account")]
    InvalidCcipSenderAta,
    #[msg("The max fee plus transfer amount overflows")]
    FeeOverflow,
    #[msg("The fee the router billed could not be reconciled against max_fee")]
    FeeAccountingFailed,
    #[msg("CPI target did not return data")]
    MissingCpiReturnData,
    #[msg("CPI return data came from an unexpected program")]
    InvalidCpiReturnProgram,
    #[msg("The instruction data to resolve accounts for is malformed or unsupported")]
    InvalidResolutionInstructionData,
    #[msg("The chain config is not the one for the message's destination chain")]
    InvalidChainConfig,
    #[msg("The account passed as the router's config is not its config PDA")]
    InvalidRouterConfig,
    #[msg("The transferred token's mint is missing from the resolution accounts")]
    MissingTransferTokenMint,
    #[msg("The router returned a malformed account resolution response")]
    InvalidResolutionResponse,
    #[msg("The native SOL fee billed by the router exceeds max_fee")]
    MaxFeeExceeded,
    #[msg("Failed to serialize the router instruction data")]
    SerializationFailed,
    #[msg("The router returned a malformed message id")]
    InvalidMessageId,
    #[msg("Address is not the program upgrade authority")]
    Unauthorized,
}
