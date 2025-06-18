import { PublicKey } from "@solana/web3.js";
import { uint64ToLE } from "./common";

/**
 * Token Pool PDA utilities
 */

// Token Pool seed constants (must match Rust base-token-pool constants)
export const TOKEN_POOL_STATE_SEED = "ccip_tokenpool_config";
export const TOKEN_POOL_CHAIN_CONFIG_SEED = "ccip_tokenpool_chainconfig";
export const TOKEN_POOL_POOL_SIGNER_SEED = "ccip_tokenpool_signer";
export const TOKEN_POOL_RATE_LIMIT_STATE_SEED = "rate_limit_state";
export const TOKEN_POOL_CHAIN_RATE_LIMIT_SEED = "chain_rate_limit";
export const TOKEN_POOL_BURN_TRACKING_SEED = "burn_tracking";
export const TOKEN_POOL_MINT_TRACKING_SEED = "mint_tracking";
export const TOKEN_POOL_GLOBAL_CONFIG_SEED = "config";

// Solana system program IDs
// Use the official BPF Loader Upgradeable Program ID
// This is hardcoded because @solana/web3.js does not export it directly
export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

/**
 * Finds the State PDA for the burn-mint pool (main configuration)
 * @param mint Token mint
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findBurnMintPoolConfigPDA(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_POOL_STATE_SEED), mint.toBuffer()],
    programId
  );
}

/**
 * Finds the Chain Config PDA for a chain selector and token mint
 * @param chainSelector Chain selector
 * @param tokenMint Token mint
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findBurnMintPoolChainConfigPDA(
  chainSelector: bigint,
  tokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOKEN_POOL_CHAIN_CONFIG_SEED),
      uint64ToLE(chainSelector),
      tokenMint.toBuffer(),
    ],
    programId
  );
}

/**
 * Finds the Program Data PDA for the burn-mint pool program
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findProgramDataPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_LOADER_UPGRADEABLE_PROGRAM_ID
  );
}

/**
 * Finds the Global Config PDA for the burn-mint pool program
 * This is used for global program configuration
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findGlobalConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_POOL_GLOBAL_CONFIG_SEED)],
    programId
  );
}

/**
 * Finds the Rate Limit State PDA for a token mint
 * This is used for global rate limiting
 * @param tokenMint Token mint
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findRateLimitStatePDA(
  tokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_POOL_RATE_LIMIT_STATE_SEED), tokenMint.toBuffer()],
    programId
  );
}

/**
 * Finds the Chain Rate Limit PDA for a chain selector and token mint
 * This is used for per-chain rate limiting
 * @param chainSelector Chain selector
 * @param tokenMint Token mint
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findChainRateLimitPDA(
  chainSelector: bigint,
  tokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOKEN_POOL_CHAIN_RATE_LIMIT_SEED),
      uint64ToLE(chainSelector),
      tokenMint.toBuffer(),
    ],
    programId
  );
}

/**
 * Finds the Pool Signer PDA for a mint
 * Used as the authority for token accounts
 * @param mint Token mint
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findPoolSignerPDA(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_POOL_POOL_SIGNER_SEED), mint.toBuffer()],
    programId
  );
}

/**
 * Finds the Burn Tracking PDA for a message ID
 * @param messageId Message ID as byte array
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findBurnTrackingPDA(
  messageId: Uint8Array,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_POOL_BURN_TRACKING_SEED), Buffer.from(messageId)],
    programId
  );
}

/**
 * Finds the Mint Tracking PDA for a message ID
 * @param messageId Message ID as byte array
 * @param programId Burn-mint pool program ID
 * @returns [PDA, bump]
 */
export function findMintTrackingPDA(
  messageId: Uint8Array,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_POOL_MINT_TRACKING_SEED), Buffer.from(messageId)],
    programId
  );
}
