/// Module for the initialize instruction
pub mod initialize;
/// Module for the initialize_token_vault instruction
pub mod initialize_token_vault;
/// Module for the ccip_receive instruction
pub mod ccip_receive;
/// Module for the get_latest_message instruction
pub mod get_latest_message;

// Re-export the account structures and handlers
pub use initialize::{Initialize, initialize_handler};
pub use initialize_token_vault::{InitializeTokenVault, initialize_token_vault_handler};
pub use ccip_receive::{CcipReceive, ccip_receive_handler};
pub use get_latest_message::{GetLatestMessage, get_latest_message_handler}; 