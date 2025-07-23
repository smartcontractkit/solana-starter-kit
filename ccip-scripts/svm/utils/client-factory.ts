import {
  CCIPClient,
  CCIPClientOptions,
  CCIPContext,
  LogLevel,
  createLogger,
  CCIPProvider,
  TokenPoolType,
  TokenPoolProgramIds,
} from "../../../ccip-lib/svm";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";
import {
  ChainId,
  getCCIPSVMConfig,
  adaptSVMConfigForLibrary,
} from "../../config";
import { createProviderFromPath } from "./provider";
import { CommonOptions, getKeypairPath } from "./config-parser";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

/**
 * Supported client types for the unified factory
 */
export type SVMClientType = 'ccip' | 'token-pool' | 'token-registry';

/**
 * Options for creating any SVM client through the unified factory
 */
export interface SVMClientFactoryOptions
  extends CCIPClientOptions,
    CommonOptions {
  /** Type of client to create */
  clientType?: SVMClientType;
  /** Program ID for token pool operations (required for token-pool client) */
  burnMintPoolProgramId?: PublicKey;
  /** Router program ID for registry operations (required for token-registry client) */
  routerProgramId?: string;
}

/**
 * Legacy interface for backward compatibility
 */
export interface CCIPClientFactoryOptions
  extends CCIPClientOptions,
    CommonOptions {}

/**
 * Internal helper to create the common CCIP context
 * This eliminates the duplication across all factory functions
 */
function createCCIPContext(
  options: SVMClientFactoryOptions,
  loggerName: string
): CCIPContext {
  // We only support SOLANA_DEVNET for now
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  const keypairPath = getKeypairPath(options);

  // Create provider from keypair path
  const provider = createProviderFromPath(keypairPath, config.connection);

  // Build context with config and provider
  return {
    // Use the adapter function to convert our config to the format expected by the library
    config: adaptSVMConfigForLibrary(config),
    provider,
    logger:
      options.logLevel !== undefined
        ? createLogger(loggerName, { level: options.logLevel })
        : undefined,
  };
}

/**
 * Unified factory for creating any SVM client type
 * This consolidates the logic that was duplicated across 3 separate factories
 *
 * @param options Client creation options including client type
 * @returns The requested client instance
 */
export function createSVMClient<T extends SVMClientType>(
  options: SVMClientFactoryOptions & { clientType: T }
): T extends 'ccip' ? CCIPClient 
  : T extends 'token-pool' ? TokenPoolManager
  : T extends 'token-registry' ? TokenRegistryClient
  : never {
  
  switch (options.clientType) {
    case 'ccip': {
      const context = createCCIPContext(options, "ccip-client");
      return new CCIPClient(context) as any;
    }
    
    case 'token-pool': {
      if (!options.burnMintPoolProgramId) {
        throw new Error("burnMintPoolProgramId is required for token-pool client");
      }
      const context = createCCIPContext(options, "token-pool-manager");
      const programIds: TokenPoolProgramIds = {
        burnMint: options.burnMintPoolProgramId,
      };
      return new TokenPoolManager(context, programIds) as any;
    }
    
    case 'token-registry': {
      if (!options.routerProgramId) {
        throw new Error("routerProgramId is required for token-registry client");
      }
      const context = createCCIPContext(options, "token-registry-client");
      return new TokenRegistryClient(context, new PublicKey(options.routerProgramId)) as any;
    }
    
    default:
      throw new Error(`Unknown client type: ${options.clientType}`);
  }
}

/**
 * Creates a configured CCIPClient instance
 * Legacy function maintained for backward compatibility
 *
 * @param options Client creation options
 * @returns CCIPClient instance
 */
export function createCCIPClient(
  options: CCIPClientFactoryOptions = {}
): CCIPClient {
  return createSVMClient({
    ...options,
    clientType: 'ccip' as const
  });
}

/**
 * Options for creating a TokenPoolManager
 */
export interface TokenPoolManagerOptions extends CommonOptions {
  connection?: Connection;
}

/**
 * Creates a TokenPoolManager for managing token pools
 * Legacy function maintained for backward compatibility - uses the unified factory internally
 *
 * @param burnMintPoolProgramId Program ID for the burn-mint pool
 * @param options Client creation options
 * @returns TokenPoolManager instance
 */
export function createTokenPoolManager(
  burnMintPoolProgramId: PublicKey,
  options: TokenPoolManagerOptions = {}
): TokenPoolManager {
  return createSVMClient({
    ...options,
    clientType: 'token-pool' as const,
    burnMintPoolProgramId
  });
}

/**
 * Options for creating a TokenRegistryClient
 */
export interface TokenRegistryClientOptions extends CommonOptions {
  connection?: Connection;
}

/**
 * Creates a TokenRegistryClient for managing token registrations
 * Legacy function maintained for backward compatibility - uses the unified factory internally
 *
 * @param routerProgramId Router program ID
 * @param options Client creation options
 * @returns TokenRegistryClient instance
 */
export function createTokenRegistryClient(
  routerProgramId: string,
  options: TokenRegistryClientOptions = {}
): TokenRegistryClient {
  return createSVMClient({
    ...options,
    clientType: 'token-registry' as const,
    routerProgramId
  });
}

/**
 * Loads the CCIP Basic Receiver IDL and creates an Anchor Program instance
 * 
 * This function sets up an Anchor program interface for interacting with the CCIP Basic Receiver.
 * It reads the IDL from the local build artifacts and creates a program instance that can be used
 * to call instructions and fetch account data from the receiver program.
 * 
 * @param keypairPath Path to the keypair file for signing transactions
 * @param connection Web3 connection to use for RPC calls
 * @param programId Program ID of the receiver (optional, will use the one from IDL if not provided)
 * @returns Object containing the Anchor Program instance and the loaded IDL
 * @throws Error if IDL file is not found or program ID cannot be determined
 * 
 * @example
 * ```typescript
 * const { program, idl } = loadReceiverProgram(
 *   "~/.config/solana/id.json",
 *   connection,
 *   new PublicKey("11111111111111111111111111111112")
 * );
 * ```
 */
export function loadReceiverProgram(
  keypairPath: string,
  connection: Connection,
  programId?: PublicKey
): { program: anchor.Program; idl: any } {
  // Set up Anchor provider
  const provider = createProviderFromPath(keypairPath, connection);
  const anchorProvider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(provider.wallet as Keypair),
    { commitment: "confirmed" }
  );
  anchor.setProvider(anchorProvider);

  // Find the local IDL file
  const idlPath = path.join(
    __dirname,
    "../../../target/idl/ccip_basic_receiver.json"
  );

  if (!fs.existsSync(idlPath)) {
    throw new Error(
      `IDL file not found at ${idlPath}. Please build the program first with 'anchor build'`
    );
  }

  // Read IDL
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Use provided programId or get from IDL
  const programIdToUse =
    programId ||
    (idl.address
      ? new PublicKey(idl.address)
      : idl.metadata?.address
      ? new PublicKey(idl.metadata.address)
      : null);

  if (!programIdToUse) {
    throw new Error("Program ID not provided and not found in IDL metadata");
  }

  // Create program interface
  const program = new anchor.Program(idl, anchorProvider);

  return { program, idl };
}
