/// Seed for the program state PDA
pub const STATE_SEED: &[u8] = b"state";

/// Seed for the messages storage PDA
pub const MESSAGES_STORAGE_SEED: &[u8] = b"messages_storage";

/// Seed for the token vault PDA
pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";

/// Seed for the external execution config PDA
pub const EXTERNAL_EXECUTION_CONFIG_SEED: &[u8] = b"external_execution_config";

/// Seed for allowed offramp PDA
pub const ALLOWED_OFFRAMP: &[u8] = b"allowed_offramp";

/// Anchor discriminator size (8 bytes)
pub const ANCHOR_DISCRIMINATOR: usize = 8;

/// Maximum size of message data we support
pub const MAX_MESSAGE_SIZE: usize = 1000; // Adjust based on expected message size 