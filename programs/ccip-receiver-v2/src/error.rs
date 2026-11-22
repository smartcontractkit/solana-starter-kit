use anchor_lang::prelude::*;

#[error_code]
pub enum CcipReceiverError {
    #[msg("Caller is not an allowed CCIP OffRamp")]
    InvalidCaller,
    #[msg("Only the owner can call this instruction")]
    OnlyOwner,
    #[msg("Only the program upgrade authority can initialize")]
    Unauthorized,
    #[msg("Router cannot be the default public key")]
    InvalidRouter,
    #[msg("Message data exceeds the maximum stored size")]
    MessageDataTooLarge,
    #[msg("Sender address exceeds the maximum stored size")]
    SenderTooLarge,
    #[msg("Too many CCVs")]
    TooManyCCVs,
    #[msg("Duplicate CCV")]
    DuplicateCCV,
    #[msg("Default public key is not allowed as an optional CCV")]
    ZeroPubkeyNotAllowedAsOptional,
    #[msg("Invalid optional threshold")]
    InvalidOptionalThreshold,
    #[msg("Unsupported CCV config version")]
    UnsupportedConfigVersion,
}
