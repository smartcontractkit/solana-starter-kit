import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { CCIPProvider, AddressConversion } from "../../ccip-sdk";
import fs from "fs";
import path from "path";

// Default file path for the keypair (standard Solana location)
export const DEFAULT_KEYPAIR_PATH = path.resolve(
  process.env.HOME || "",
  ".config/solana/id.json"
);

/**
 * Loads a keypair from a file
 * @param filePath Path to keypair file
 * @returns Keypair
 */
export function loadKeypair(filePath: string = DEFAULT_KEYPAIR_PATH): Keypair {
  try {
    const keypairData = fs.readFileSync(filePath, "utf-8");
    const keypairJson = JSON.parse(keypairData);
    return Keypair.fromSecretKey(Buffer.from(keypairJson));
  } catch (error) {
    console.error(`Error loading keypair from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Creates a provider from a keypair path and connection
 * @param keypairPath Path to the keypair file
 * @param connection Connection to Solana network
 * @returns CCIPProvider instance
 */
export function createProviderFromPath(
  keypairPath: string,
  connection: Connection
): CCIPProvider {
  const keypair = loadKeypair(keypairPath);
  return createKeypairProvider(keypair, connection);
}

/**
 * Creates a provider from a keypair and connection
 * @param keypair Keypair to use for signing
 * @param connection Connection to Solana network
 * @returns CCIPProvider instance
 */
export function createKeypairProvider(
  keypair: Keypair,
  connection: Connection
): CCIPProvider {
  return {
    connection,
    wallet: keypair,
    getAddress(): PublicKey {
      return keypair.publicKey;
    },
    async signTransaction(
      tx: Transaction | VersionedTransaction
    ): Promise<Transaction | VersionedTransaction> {
      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair]);
      } else {
        tx.partialSign(keypair);
      }
      return tx;
    },
  };
}

// Re-export the SDK's AddressConversion for convenience
export { AddressConversion }; 