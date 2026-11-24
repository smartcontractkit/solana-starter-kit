use anchor_lang::prelude::*;

#[error_code]
pub enum CcipReceiverError {
    #[msg("Invalid router address")]
    InvalidRouter,
    #[msg("Address is not owner")]
    OnlyOwner,
    #[msg("Address is not proposed_owner")]
    OnlyProposedOwner,
    #[msg("Caller is not allowed")]
    InvalidCaller,
    #[msg("Proposed owner is invalid")]
    InvalidProposedOwner,
    #[msg("Remote sender address exceeds the maximum PDA seed length")]
    SenderAddressTooLong,
    /// Errors specific to the CCIP v2 additions (CCV/finality configuration).
    #[msg("Duplicate CCV in configuration")]
    DuplicateCCV = 100,
    #[msg("Optional threshold is invalid for the given optional CCVs")]
    InvalidOptionalThreshold,
    #[msg("Zero pubkey is not allowed as an optional CCV")]
    ZeroPubkeyNotAllowedAsOptional,
    #[msg("Invalid finality config")]
    InvalidFinalityConfig,
    #[msg("Too many CCVs configured")]
    TooManyCCVs,
    #[msg("Unsupported SourceChainCcvConfig account version")]
    UnsupportedConfigVersion,
    #[msg("Address is not the program upgrade authority")]
    Unauthorized,
}
