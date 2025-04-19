/// Module for the initialize instruction
pub mod initialize;
/// Module for the initialize_token_vault instruction
pub mod initialize_token_vault;
/// Module for the ccip_receive instruction
pub mod ccip_receive;
/// Module for the get_latest_message instruction
pub mod get_latest_message;

// Export handler functions
pub use initialize::handler as initialize_handler;
pub use initialize_token_vault::handler as initialize_token_vault_handler;
pub use ccip_receive::handler as ccip_receive_handler;
pub use get_latest_message::handler as get_latest_message_handler;
