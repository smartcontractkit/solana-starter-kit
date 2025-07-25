import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { CCIPContext, CCIPProvider, CCIPCoreConfig } from "../models";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { TokenPoolClient } from "../../tokenpools/abstract";
import {
  TokenPoolFactory,
  TokenPoolProgramIds,
} from "../../tokenpools/factory";
import { TokenPoolType } from "../../tokenpools";
import { TokenRegistryClient } from "./tokenregistry";
import { loadKeypair } from "../../utils/keypair";

/**
 * Manages token pool operations for CCIP
 */
export class TokenPoolManager {
  private readonly logger: Logger;
  private readonly registryClient: TokenRegistryClient;

  /**
   * Creates a new TokenPoolManager
   * @param context CCIP context
   * @param programIds Map of program IDs for different token pool types
   */
  constructor(
    private readonly context: CCIPContext,
    private readonly programIds: TokenPoolProgramIds
  ) {
    this.logger =
      context.logger ??
      createLogger("token-pool-manager", { level: LogLevel.INFO });
    this.registryClient = new TokenRegistryClient(
      context,
      context.config.ccipRouterProgramId
    );
    this.logger.debug("TokenPoolManager initialized");
  }

  /**
   * Creates a new TokenPoolManager from simplified configuration
   * @param connection Solana connection
   * @param wallet Keypair for signing
   * @param programIds Pool program IDs
   * @param config Partial configuration
   * @param options Optional manager options
   * @returns A new TokenPoolManager instance
   */
  static create(
    connection: Connection,
    wallet: Keypair,
    programIds: TokenPoolProgramIds,
    config: {
      ccipRouterProgramId: string;
      feeQuoterProgramId: string;
      rmnRemoteProgramId: string;
      linkTokenMint?: string;
      receiverProgramId?: string;
    },
    options?: { logLevel?: LogLevel }
  ): TokenPoolManager {
    // Create provider
    const provider: CCIPProvider = {
      connection,
      wallet,
      getAddress: () => wallet.publicKey,
      signTransaction: async (tx) => {
        if ('version' in tx) {
          tx.sign([wallet]);
        } else {
          tx.partialSign(wallet);
        }
        return tx;
      },
    };

    // Build core config
    const coreConfig: CCIPCoreConfig = {
      ccipRouterProgramId: new PublicKey(config.ccipRouterProgramId),
      feeQuoterProgramId: new PublicKey(config.feeQuoterProgramId),
      rmnRemoteProgramId: new PublicKey(config.rmnRemoteProgramId),
      linkTokenMint: new PublicKey(config.linkTokenMint || "LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L"),
      tokenMint: PublicKey.default,
      nativeSol: PublicKey.default,
      systemProgramId: new PublicKey("11111111111111111111111111111111"),
      programId: new PublicKey(config.receiverProgramId || "BqmcnLFSbKwyMEgi7VhVeJCis1wW26VySztF34CJrKFq"),
    };

    // Create context
    const context: CCIPContext = {
      provider,
      config: coreConfig,
      logger: createLogger("token-pool-manager", { level: options?.logLevel ?? LogLevel.INFO }),
    };

    return new TokenPoolManager(context, programIds);
  }

  /**
   * Creates a new TokenPoolManager from keypair file
   * @param keypairPath Path to keypair file
   * @param endpoint RPC endpoint
   * @param programIds Pool program IDs
   * @param config Configuration
   * @param options Optional manager options
   * @returns A new TokenPoolManager instance
   */
  static createFromKeypair(
    keypairPath: string,
    endpoint: string,
    programIds: TokenPoolProgramIds,
    config: {
      ccipRouterProgramId: string;
      feeQuoterProgramId: string;
      rmnRemoteProgramId: string;
      linkTokenMint?: string;
      receiverProgramId?: string;
    },
    options?: { logLevel?: LogLevel; commitment?: string }
  ): TokenPoolManager {
    const wallet = loadKeypair(keypairPath);
    const connection = new Connection(endpoint, options?.commitment as any || "confirmed");
    return TokenPoolManager.create(connection, wallet, programIds, config, options);
  }

  /**
   * Get a token pool client for a specific pool type
   * @param type Pool type to use
   * @returns TokenPoolClient instance for the specified type
   */
  getTokenPoolClient(type: TokenPoolType): TokenPoolClient {
    this.logger.debug(`Creating token pool client of type: ${type}`);
    return TokenPoolFactory.create(type, this.context, this.programIds);
  }

  /**
   * Get the token registry client for managing token pool registrations
   * @returns TokenRegistryClient instance
   */
  getRegistryClient(): TokenRegistryClient {
    return this.registryClient;
  }

  /**
   * Detect and get the appropriate token pool client for a mint
   * This looks at on-chain accounts to determine which pool type is used
   *
   * @param mint Token mint public key
   * @returns TokenPoolClient instance for the detected pool type
   * @throws If no token pool is found for the mint
   */
  async getTokenPoolClientForMint(mint: PublicKey): Promise<TokenPoolClient> {
    this.logger.debug(`Detecting token pool type for mint: ${mint.toString()}`);
    const poolType = await TokenPoolFactory.detectPoolType(
      mint,
      this.context,
      this.programIds
    );
    return this.getTokenPoolClient(poolType);
  }

  /**
   * Initialize a chain remote configuration for a token pool.
   *
   * This method creates a new chain configuration for the specified remoteChainSelector.
   * The chain configuration must not already exist for this operation to succeed.
   *
   * @param mint Token mint identifying the pool
   * @param destChainSelector The unique identifier of the remote blockchain network
   * @param options Configuration options including remote token address, pool addresses, and decimals
   * @param poolType Optional pool type (if not provided, it will be auto-detected)
   * @returns Transaction signature
   * @throws If the pool doesn't exist, if the chain config already exists, or if the transaction fails
   */
  async initChainRemoteConfig(
    mint: PublicKey,
    destChainSelector: bigint,
    options: any,
    poolType?: TokenPoolType
  ): Promise<string> {
    this.logger.debug(
      `Initializing chain remote config for mint: ${mint.toString()}, chain: ${destChainSelector.toString()}`
    );

    const client = poolType
      ? this.getTokenPoolClient(poolType)
      : await this.getTokenPoolClientForMint(mint);

    const result = await client.initChainRemoteConfig(
      mint,
      destChainSelector,
      options
    );
    return result.signature;
  }

  /**
   * Edit an existing chain remote configuration for a token pool.
   *
   * This method updates an existing chain configuration for the specified remoteChainSelector.
   * The chain configuration must already exist for this operation to succeed.
   *
   * @param mint Token mint identifying the pool
   * @param destChainSelector The unique identifier of the remote blockchain network
   * @param options Configuration options including remote token address, pool addresses, and decimals
   * @param poolType Optional pool type (if not provided, it will be auto-detected)
   * @returns Transaction signature
   * @throws If the pool doesn't exist, if the chain config doesn't exist, or if the transaction fails
   */
  async editChainRemoteConfig(
    mint: PublicKey,
    destChainSelector: bigint,
    options: any,
    poolType?: TokenPoolType
  ): Promise<string> {
    this.logger.debug(
      `Editing chain remote config for mint: ${mint.toString()}, chain: ${destChainSelector.toString()}`
    );

    const client = poolType
      ? this.getTokenPoolClient(poolType)
      : await this.getTokenPoolClientForMint(mint);

    const result = await client.editChainRemoteConfig(
      mint,
      destChainSelector,
      options
    );
    return result.signature;
  }
}
