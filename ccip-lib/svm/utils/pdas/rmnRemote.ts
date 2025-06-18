import { PublicKey } from "@solana/web3.js";

/**
 * RMN Remote PDA utilities
 */

/**
 * Finds the RMN Remote Config PDA for a program
 * @param programId RMN Remote program ID
 * @returns [PDA, bump]
 */
export function findRMNRemoteConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

/**
 * Finds the RMN Remote Curses PDA for a program
 * @param programId RMN Remote program ID
 * @returns [PDA, bump]
 */
export function findRMNRemoteCursesPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("curses")], programId);
} 