import { PublicKey, Connection } from "@solana/web3.js";
import { TokenPoolType, createLogger } from "../../../ccip-lib/svm";
import { createTokenPoolManager } from "../utils/client-factory";
import { ChainId, getCCIPSVMConfig } from "../../config";
import { loadKeypair } from "../utils/provider";
import { CommonOptions, getKeypairPath } from "../utils/config-parser";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";

const logger = createLogger("TokenPoolClient");

export interface TokenPoolInfo {
  programId: PublicKey;
  config: any;
  poolType: string;
}

/**
 * Options for initializing a pool
 */
export interface InitializePoolOptions {
  mint: PublicKey;
  txOptions?: any; // Replace with specific options if available
}

/**
 * Options for configuring a chain
 */
export interface ConfigureChainOptions {
  mint: PublicKey;
  remoteChainSelector: bigint;
  poolAddresses: string[];
  tokenAddress: string;
  decimals: number;
}

/**
 * Options for setting rate limits
 */
export interface SetRateLimitOptions {
  mint: PublicKey;
  remoteChainSelector: bigint;
  inbound: any; // Replace with specific inbound rate limit type
  outbound: any; // Replace with specific outbound rate limit type
}

/**
 * Options for checking if a pool exists
 */
export interface HasPoolOptions {
  mint: PublicKey;
}

/**
 * Options for checking if a chain config exists
 */
export interface HasChainConfigOptions {
  mint: PublicKey;
  remoteChainSelector: bigint;
}

/**
 * Options for transferring an admin role
 */
export interface TransferAdminRoleOptions {
  mint: PublicKey;
  newAdmin: PublicKey;
}

/**
 * Options for accepting an admin role
 */
export interface AcceptAdminRoleOptions {
  mint: PublicKey;
}

/**
 * Options for setting a router
 */
export interface SetRouterOptions {
  mint: PublicKey;
  newRouter: PublicKey;
}

/**
 * Options for configuring an allowlist
 */
export interface ConfigureAllowlistOptions {
  mint: PublicKey;
  add: PublicKey[];
  enabled: boolean;
}

/**
 * Options for removing from an allowlist
 */
export interface RemoveFromAllowlistOptions {
  mint: PublicKey;
  remove: PublicKey[];
}

/**
 * Options for appending remote pool addresses
 */
export interface AppendRemotePoolAddressesOptions {
  mint: PublicKey;
  remoteChainSelector: bigint;
  addresses: string[];
}

/**
 * Options for deleting a chain config
 */
export interface DeleteChainConfigOptions {
  mint: PublicKey;
  remoteChainSelector: bigint;
}

export interface TokenPoolClient {
  /**
   * Gets information about the token pool
   * @param options The options for getting pool info
   * @returns Pool information
   */
  getPoolInfo(): Promise<BurnMintTokenPoolInfo>;

  /**
   * Initializes a new token pool
   * @param options The options for initializing a pool
   * @returns Transaction signature
   */
  initializePool(options: InitializePoolOptions): Promise<string>;

  /**
   * Configures a chain for the token pool
   * @param options The options for configuring a chain
   * @returns Transaction signature
   */
  configureChain(options: ConfigureChainOptions): Promise<string>;

  /**
   * Sets rate limits for token transfers
   * @param options The options for setting rate limits
   * @returns Transaction signature
   */
  setRateLimit(options: SetRateLimitOptions): Promise<string>;

  /**
   * Checks if a pool exists for the given mint
   * @param options The options for checking if a pool exists
   * @returns Whether the pool exists
   */
  hasPool(options: HasPoolOptions): Promise<boolean>;

  /**
   * Checks if a chain configuration exists
   * @param options The options for checking if a chain config exists
   * @returns Whether the chain config exists
   */
  hasChainConfig(options: HasChainConfigOptions): Promise<boolean>;

  /**
   * Transfers the admin role to a new administrator
   * @param options The options for transferring admin role
   * @returns Transaction signature
   */
  transferAdminRole(options: TransferAdminRoleOptions): Promise<string>;

  /**
   * Accepts the admin role for a token
   * @param options The options for accepting admin role
   * @returns Transaction signature
   */
  acceptAdminRole(options: AcceptAdminRoleOptions): Promise<string>;

  /**
   * Sets the router for a token pool
   * @param options The options for setting a router
   * @returns Transaction signature
   */
  setRouter(options: SetRouterOptions): Promise<string>;

  /**
   * Configures the allowlist for a token pool
   * @param options The options for configuring an allowlist
   * @returns Transaction signature
   */
  configureAllowlist(options: ConfigureAllowlistOptions): Promise<string>;

  /**
   * Removes addresses from the allowlist
   * @param options The options for removing from an allowlist
   * @returns Transaction signature
   */
  removeFromAllowlist(options: RemoveFromAllowlistOptions): Promise<string>;

  /**
   * Appends remote pool addresses
   * @param options The options for appending remote pool addresses
   * @returns Transaction signature
   */
  appendRemotePoolAddresses(
    options: AppendRemotePoolAddressesOptions
  ): Promise<string>;

  /**
   * Deletes a chain configuration
   * @param options The options for deleting a chain config
   * @returns Transaction signature
   */
  deleteChainConfig(options: DeleteChainConfigOptions): Promise<string>;
}

/**
 * Options for creating a token pool client
 */
export interface TokenPoolClientOptions extends CommonOptions {
  connection: Connection;
}

/**
 * Creates a TokenPoolClient that wraps the SDK's BurnMintTokenPoolClient with the script-specific interface
 */
export async function createTokenPoolClient(
  programId: PublicKey,
  tokenMint: PublicKey,
  options: TokenPoolClientOptions
): Promise<TokenPoolClient> {
  // Get the token pool manager directly using the factory function
  const tokenPoolManager = createTokenPoolManager(programId, options);

  // Get the burn-mint token pool client from the manager
  const sdkClient = tokenPoolManager.getTokenPoolClient(
    TokenPoolType.BURN_MINT
  );

  const mintPubkey = tokenMint;
  const connection = options.connection;

  logger.info(
    `Created token pool client for program: ${programId}, token: ${tokenMint}`
  );

  // Create a wrapper around the SDK client that implements our interface
  return {
    getPoolInfo: async () => {
      logger.info(`Fetching pool info for token: ${tokenMint}`);
      try {
        const sdkPoolInfo = (await sdkClient.getPoolInfo(
          mintPubkey
        )) as BurnMintTokenPoolInfo;

        logger.debug(`Pool info retrieved: ${JSON.stringify(sdkPoolInfo)}`);
        return sdkPoolInfo;
      } catch (error) {
        logger.error(
          `Failed to fetch pool info: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    initializePool: async (options: InitializePoolOptions) => {
      const { mint, txOptions } = options;
      logger.info(`Initializing pool for mint: ${mint.toString()}`);
      try {
        const tx = await sdkClient.initializePool(mint, {
          txOptions: txOptions || {},
        });

        logger.info(`Pool initialized successfully. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to initialize pool: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    configureChain: async (options: ConfigureChainOptions) => {
      const {
        mint,
        remoteChainSelector,
        poolAddresses,
        tokenAddress,
        decimals,
      } = options;
      logger.info(
        `Configuring chain ${remoteChainSelector.toString()} for mint: ${mint.toString()}`
      );
      try {
        const tx = await sdkClient.configureChain(mint, remoteChainSelector, {
          poolAddresses,
          tokenAddress,
          decimals,
        });

        logger.info(`Chain configured successfully. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to configure chain: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    setRateLimit: async (options: SetRateLimitOptions) => {
      const { mint, remoteChainSelector, inbound, outbound } = options;
      logger.info(
        `Setting rate limits for chain ${remoteChainSelector.toString()} on mint: ${mint.toString()}`
      );
      try {
        const tx = await sdkClient.setRateLimit(mint, remoteChainSelector, {
          inbound,
          outbound,
        });

        logger.info(`Rate limits set successfully. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to set rate limits: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    hasPool: async (options: HasPoolOptions) => {
      const { mint } = options;
      try {
        await sdkClient.getPoolInfo(mint);
        return true;
      } catch (error) {
        return false;
      }
    },

    hasChainConfig: async (options: HasChainConfigOptions) => {
      const { mint, remoteChainSelector } = options;
      logger.info(
        `Checking if chain config exists for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
      );
      
      try {
        // First check if the pool exists at all
        try {
          await sdkClient.getPoolInfo(mint);
        } catch (error) {
          logger.debug(`No pool found for mint: ${mint.toString()}`);
          return false;
        }
        
        // If available, prefer a direct exists check method
        const accountReader = sdkClient.getAccountReader();
        
        // Check specifically for chain config existence
        // Use appropriate SDK method if available (hasChainConfig, existsChainConfig, etc.)
        // If no direct check method available, fetch with minimal data 
        const chainConfig = await accountReader.getChainConfig(
          mint, 
          remoteChainSelector
        );
        
        const exists = !!chainConfig;
        logger.debug(
          `Chain config ${exists ? "exists" : "does not exist"} for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
        );
        return exists;
      } catch (error) {
        // Only log at debug level since this might be an expected case
        logger.debug(
          `Error checking chain config: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      }
    },

    transferAdminRole: async (options: TransferAdminRoleOptions) => {
      const { mint, newAdmin } = options;
      logger.info(
        `Transferring admin role for mint: ${mint.toString()} to: ${newAdmin.toString()}`
      );
      try {
        // Use the SDK client to transfer admin role
        const tx = await sdkClient.transferAdminRole(mint, {
          newAdmin,
        });

        logger.info(`Admin role transfer proposed. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to transfer admin role: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    acceptAdminRole: async (options: AcceptAdminRoleOptions) => {
      const { mint } = options;
      logger.info(`Accepting admin role for mint: ${mint.toString()}`);
      try {
        // Use the SDK client to accept admin role
        const tx = await sdkClient.acceptAdminRole(mint);

        logger.info(`Admin role accepted. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to accept admin role: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    setRouter: async (options: SetRouterOptions) => {
      const { mint, newRouter } = options;
      logger.info(
        `Setting router for mint: ${mint.toString()} to: ${newRouter.toString()}`
      );
      try {
        // Use the SDK client to set router
        const tx = await sdkClient.setRouter(mint, {
          newRouter,
        });

        logger.info(`Router updated. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to set router: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    configureAllowlist: async (options: ConfigureAllowlistOptions) => {
      const { mint, add, enabled } = options;
      logger.info(
        `Configuring allowlist for mint: ${mint.toString()}, enabled: ${enabled}`
      );
      try {
        // Use the SDK client to configure allowlist
        const tx = await sdkClient.configureAllowlist(mint, {
          add,
          enabled,
        });

        logger.info(`Allowlist configured. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to configure allowlist: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    removeFromAllowlist: async (options: RemoveFromAllowlistOptions) => {
      const { mint, remove } = options;
      logger.info(
        `Removing addresses from allowlist for mint: ${mint.toString()}`
      );
      try {
        // Use the SDK client to remove from allowlist
        const tx = await sdkClient.removeFromAllowlist(mint, {
          remove,
        });

        logger.info(`Addresses removed from allowlist. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to remove from allowlist: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    appendRemotePoolAddresses: async (
      options: AppendRemotePoolAddressesOptions
    ) => {
      const { mint, remoteChainSelector, addresses } = options;
      logger.info(
        `Appending remote pool addresses for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
      );
      try {
        // Use the SDK client to append remote pool addresses
        const tx = await sdkClient.appendRemotePoolAddresses(mint, {
          remoteChainSelector,
          addresses,
        });

        logger.info(`Remote pool addresses appended. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to append remote pool addresses: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    deleteChainConfig: async (options: DeleteChainConfigOptions) => {
      const { mint, remoteChainSelector } = options;
      logger.info(
        `Deleting chain config for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
      );
      try {
        // Use the SDK client to delete chain config
        const tx = await sdkClient.deleteChainConfig(mint, {
          remoteChainSelector,
        });

        logger.info(`Chain config deleted. Transaction: ${tx}`);
        return tx;
      } catch (error) {
        logger.error(
          `Failed to delete chain config: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },
  };
}
