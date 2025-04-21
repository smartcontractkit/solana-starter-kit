/// Seed for the program state PDA
pub const STATE_SEED: &[u8] = b"state";

/// Seed for the messages storage PDA
pub const MESSAGES_STORAGE_SEED: &[u8] = b"messages_storage";

/// Seed for the external execution config PDA
pub const EXTERNAL_EXECUTION_CONFIG_SEED: &[u8] = b"external_execution_config";

/// Seed for allowed offramp PDA
pub const ALLOWED_OFFRAMP: &[u8] = b"allowed_offramp";

/// Seed for the token admin PDA
pub const TOKEN_ADMIN_SEED: &[u8] = b"token_admin";

/// Anchor discriminator size (8 bytes)
pub const ANCHOR_DISCRIMINATOR: usize = 8;
