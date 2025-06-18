import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { CCIPProvider, AddressConversion } from "../../../ccip-lib/svm";
import fs from "fs";
import { KEYPAIR_PATHS } from "./config-parser";
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { createLogger } from "../../../ccip-lib/svm/utils/logger";

const logger = createLogger('Provider');

/**
 * Loads a keypair from a file
 * @param filePath Path to keypair file
 * @returns Keypair
 */
export function loadKeypair(filePath: string = KEYPAIR_PATHS.DEFAULT): Keypair {
  try {
    const keypairData = fs.readFileSync(filePath, "utf-8");
    const keypairJson = JSON.parse(keypairData);
    return Keypair.fromSecretKey(Buffer.from(keypairJson));
  } catch (error) {
    logger.error(`Error loading keypair from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Get a connection to the Solana network
 * @returns Connection
 */
export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  logger.info(`Connecting to ${rpcUrl}`);
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Get a provider for interacting with Solana using Anchor
 * @returns AnchorProvider with publicKey property
 */
export async function getProvider(): Promise<AnchorProvider & { publicKey: PublicKey }> {
  const keypair = loadKeypair();
  const connection = getConnection();

  const provider = new AnchorProvider(
    connection,
    new Wallet(keypair),
    AnchorProvider.defaultOptions()
  );

  // Add the publicKey directly to the provider for convenience
  (provider as any).publicKey = keypair.publicKey;

  return provider as AnchorProvider & { publicKey: PublicKey };
}

/**
 * Creates a provider from a keypair path and connection
 * @param keypairPath Path to the keypair file
 * @param connection Connection to Solana network
 * @returns CCIPProvider instance
 */
export function createProviderFromPath(
  keypairPath: string = KEYPAIR_PATHS.DEFAULT,
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
