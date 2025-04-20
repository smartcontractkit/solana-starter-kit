import { PublicKey } from "@solana/web3.js";

/**
 * CCIP Receiver PDA utilities
 */

// Seeds for the CCIP receiver program
export const RECEIVER_SEEDS = {
  EXTERNAL_EXECUTION_CONFIG: Buffer.from("external_execution_config"),
  STATE: Buffer.from("state"),
  CONFIG: Buffer.from("config"),
  DEST_CHAIN_STATE: Buffer.from("dest_chain_state"),
  FEE_BILLING_SIGNER: Buffer.from("fee_billing_signer"),
  NONCE: Buffer.from("nonce"),
  FEE_BILLING_TOKEN_CONFIG: Buffer.from("fee_billing_token_config"),
  CURSES: Buffer.from("curses"),
};

/**
 * Derives the state PDA for a CCIP receiver program
 * @param programId Receiver program ID
 * @returns State PDA
 */
export function deriveStatePda(programId: PublicKey): PublicKey {
  const [statePda] = PublicKey.findProgramAddressSync([RECEIVER_SEEDS.STATE], programId);
  return statePda;
}

/**
 * Derives the config PDA for a CCIP receiver program
 * @param programId Receiver program ID
 * @returns Config PDA
 */
export function deriveConfigPda(programId: PublicKey): PublicKey {
  const [configPda] = PublicKey.findProgramAddressSync([RECEIVER_SEEDS.CONFIG], programId);
  return configPda;
}

/**
 * Derives the external execution config PDA for a CCIP receiver program
 * @param programId Receiver program ID
 * @returns External execution config PDA
 */
export function deriveExternalExecutionConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([RECEIVER_SEEDS.EXTERNAL_EXECUTION_CONFIG], programId);
  return pda;
} 