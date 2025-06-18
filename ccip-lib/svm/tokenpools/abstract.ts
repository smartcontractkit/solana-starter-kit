import { Commitment, PublicKey } from "@solana/web3.js";
import { TokenPoolChainConfigResponse } from "../core/models";

/**
 * Options for controlling Solana transaction execution.
 */
export interface TxOptions {
  /** Whether to skip preflight transaction checks */
  skipPreflight?: boolean;
  /** Commitment level for preflight checks */
  preflightCommitment?: Commitment;
  /** Maximum number of transaction resubmissions */
  maxRetries?: number;
  /** Commitment level for getting recent blockhash */
  commitment?: Commitment;
  /** Commitment level for transaction confirmation */
  confirmationCommitment?: Commitment;
}

/**
 * Generic configuration fields that should exist on all pool configs
 */
export interface BasePoolConfigFields {
  mint: PublicKey;
  owner: PublicKey;
}

/**
 * Base token pool information
 *
 * This creates a union type that can be easily implemented by different pool types
 * by extending their config with programId and poolType fields
 */
export interface TokenPoolInfo {
  /** Pool program ID */
  programId: PublicKey;
  /** Pool type identifier */
  poolType: string;
}

/**
 * Token pool rate limit information
 */
export interface TokenPoolRateLimit {
  mint: PublicKey;
  outbound: {
    capacity: bigint;
    rate: bigint;
    consumed: bigint;
    lastUpdated: bigint;
    isEnabled: boolean;
  };
  inbound: {
    capacity: bigint;
    rate: bigint;
    consumed: bigint;
    lastUpdated: bigint;
    isEnabled: boolean;
  };
}

/**
 * Options for creating a token pool
 */
export interface TokenPoolCreateOptions {
  /** Initial administrator (defaults to the context provider address) */
  administrator?: PublicKey;
  /** Whether the pool should be enabled immediately */
  enabled?: boolean;
}

/**
 * Options for updating a token pool
 */
export interface TokenPoolUpdateOptions {
  /** New administrator (if changing) */
  administrator?: PublicKey;
  /** Update enabled status */
  enabled?: boolean;
}

/**
 * Options for configuring a chain in a burn-mint token pool
 */
export interface BurnMintChainConfigOptions {
  /** Whether transfers to this chain are enabled */
  enabled: boolean;
  /** Max tokens per message */
  maxTokensPerMessage: bigint;
  /** Fee bps (basis points) */
  feeBps: number;
  /** Pool addresses */
  poolAddresses: string[];
  /** Token address */
  tokenAddress: string;
  /** Decimals */
  decimals?: number;
  /** Transaction options */
  txOptions?: TxOptions;
}

/**
 * Options for initializing a burn-mint token pool
 */
export interface BurnMintPoolInitializeOptions {
  /** Transaction options */
  txOptions?: TxOptions;
}

/**
 * Configuration for a single rate limit (inbound or outbound)
 */
export interface BurnMintRateLimitConfigOptions {
  /** Whether this rate limit direction is enabled */
  enabled: boolean;
  /** Maximum token capacity of the bucket (in token's smallest unit) */
  capacity: bigint;
  /** Refill rate in tokens per second (in token's smallest unit) */
  rate: bigint;
}

/**
 * Options for setting rate limits for a specific chain in a burn-mint token pool
 */
export interface BurnMintSetRateLimitOptions {
  /** Configuration for the inbound rate limit */
  inbound: BurnMintRateLimitConfigOptions;
  /** Configuration for the outbound rate limit */
  outbound: BurnMintRateLimitConfigOptions;
  /** Transaction options */
  txOptions?: TxOptions;
}

/**
 * Token pool account reader interface
 *
 * Interface for reading account data for token pools, including chain configurations
 * and rate limits. Implementations of this interface should provide access to on-chain
 * data without modifying state.
 */
export interface TokenPoolAccountReader {
  /**
   * Fetch the base configuration for a token pool
   *
   * Retrieves the foundational configuration for a specific token mint's pool,
   * including ownership information, token details, and general pool settings.
   *
   * @param mint Token mint address to query
   * @returns Pool configuration data including owner, token info, and settings
   * @throws Error if pool configuration is not found for the given mint
   */
  getPoolConfig(mint: PublicKey): Promise<any>;

  /**
   * Fetch chain configurations for a token pool.
   *
   * Retrieves detailed configuration data for interacting with specific destination chains
   * associated with the token pool. This includes information like remote addresses,
   * rate limits, and supported features for cross-chain transfers.
   *
   * Use `getChainConfig` to fetch the configuration for a single destination chain,
   * identified by its unique `remoteChainSelector`.
   *
   * Use `listChainConfigs` to retrieve configurations for multiple destination chains
   * by providing an array of `remoteChainSelectors`. This method fetches and decodes
   * the raw chain configuration data from on-chain accounts.
   *
   * @param mint Token mint address identifying the pool.
   * @param remoteChainSelector (For getChainConfig) The destination chain selector.
   * @param remoteChainSelectors (For listChainConfigs) An array of destination chain selectors.
   * @returns (For getChainConfig) Chain configuration data in a user-friendly format.
   * @returns (For listChainConfigs) An array of chain configuration data, one for each found selector.
   * @throws Error if the configuration is not found for the given mint and selector(s),
   *         or if an error occurs during retrieval (e.g., empty selectors array for listChainConfigs).
   */
  getChainConfig(
    mint: PublicKey,
    remoteChainSelector: bigint
  ): Promise<TokenPoolChainConfigResponse>;

  listChainConfigs(
    mint: PublicKey,
    remoteChainSelectors: bigint[]
  ): Promise<any[]>;

  /**
   * Read rate limit configuration for a specific chain
   *
   * Retrieves the rate limit settings and current usage for a specified chain.
   * Rate limits control the maximum amount of tokens that can be transferred
   * over a given time period.
   *
   * @param mint Token mint address to query
   * @param chainSelector Blockchain network identifier
   * @returns Rate limit information including capacity, rate, current consumption, and timestamp
   * @throws Error if chain configuration is not found for the given mint and chain selector
   */
  getRateLimitConfigForChain(
    mint: PublicKey,
    remoteChainSelector: bigint
  ): Promise<TokenPoolRateLimit>;

  /**
   * Read rate limit configurations for multiple chains
   *
   * Batch retrieval of rate limit settings for multiple chains in a single call.
   * This is more efficient than making multiple individual requests when rate limits
   * for several chains are needed.
   *
   * @param mint Token mint address to query
   * @param remoteChainSelectors Array of blockchain network identifiers
   * @returns Array of rate limit information, one entry per chain selector
   * @throws Error if no chain selectors are provided or if an error occurs during retrieval
   */
  getRateLimitConfigsForChains(
    mint: PublicKey,
    remoteChainSelectors: bigint[]
  ): Promise<TokenPoolRateLimit[]>;
}

/**
 * Options for transferring admin role (proposing a new owner)
 */
export interface TransferAdminRoleOptions extends TxOptions {
  /** PublicKey of the proposed new administrator */
  newAdmin: PublicKey;
}

/**
 * Options for accepting admin role
 */
export interface AcceptAdminRoleOptions extends TxOptions {
  // No additional fields required
}

/**
 * Options for setting the router address
 */
export interface SetRouterOptions extends TxOptions {
  /** PublicKey of the new router program */
  newRouter: PublicKey;
}

/**
 * Options for appending remote pool addresses
 */
export interface AppendRemotePoolAddressesOptions extends TxOptions {
  /** The unique identifier (bigint) of the remote blockchain network */
  remoteChainSelector: bigint;
  /** An array of remote pool addresses (as 32-byte hex strings) to add */
  addresses: string[];
}

/**
 * Options for deleting a chain configuration
 */
export interface DeleteChainConfigOptions extends TxOptions {
  /** The unique identifier (bigint) of the remote chain configuration to delete */
  remoteChainSelector: bigint;
}

/**
 * Options for configuring the allowlist
 */
export interface ConfigureAllowlistOptions extends TxOptions {
  /** An array of PublicKeys to add to the allowlist */
  add: PublicKey[];
  /** Whether the allowlist check should be enabled for on-ramp operations */
  enabled: boolean;
}

/**
 * Options for removing from the allowlist
 */
export interface RemoveFromAllowlistOptions extends TxOptions {
  /** An array of PublicKeys to remove from the allowlist */
  remove: PublicKey[];
}

/**
 * Options for initializing state version
 */
export interface InitializeStateVersionOptions extends TxOptions {
  // No additional fields required
}

/**
 * Abstract interface for token pool clients
 */
export interface TokenPoolClient {
  /**
   * Get the program ID for this token pool
   */
  getProgramId(): PublicKey;

  /**
   * Get information about the token pool
   * @param mint Token mint
   */
  getPoolInfo(mint: PublicKey): Promise<TokenPoolInfo>;

  /**
   * Create a token pool for a given mint
   * @param mint Token mint
   * @param options Creation options
   */
  initializePool(
    mint: PublicKey,
    options: BurnMintPoolInitializeOptions
  ): Promise<string>;

  /**
   * Configure a chain for a token pool.
   *
   * This method handles both initializing new chain configurations and updating existing ones.
   * If the chain configuration for the specified remoteChainSelector doesn't exist, it will
   * create a new one. If it already exists, it will update the configuration.
   *
   * Only the current owner can call this method.
   *
   * @param mint Token mint identifying the pool.
   * @param destChainSelector The unique identifier (bigint) of the remote blockchain network.
   * @param options Configuration options including remote token address, pool addresses, and decimals.
   * @returns A Promise resolving to the transaction signature string.
   * @throws Error if the pool doesn't exist, if the caller lacks permissions, or if the transaction fails.
   */
  configureChain(
    mint: PublicKey,
    destChainSelector: bigint,
    options: Record<string, any>
  ): Promise<string>;

  /**
   * Sets the rate limits for a specific remote chain configuration within a token pool.
   *
   * This function configures the maximum capacity and refill rate for both inbound
   * (tokens received from the remote chain) and outbound (tokens sent to the
   * remote chain) transfers.
   *
   * Implementations of this interface will handle the specifics of constructing
   * and sending the transaction based on the pool type (e.g., burn-mint, lock-release)
   * and the provided options.
   *
   * @param mint The PublicKey of the token mint identifying the pool.
   * @param remoteChainSelector The unique identifier (bigint) of the remote blockchain network.
   * @param options An object containing the rate limit settings (`inbound`, `outbound`)
   *                and optionally transaction-specific parameters (`txOptions`).
   *                Concrete implementations use types extending `TokenPoolSetRateLimitOptions`.
   * @returns A Promise resolving to the transaction signature string upon successful execution.
   * @throws Error if the pool or chain config doesn't exist, if the caller lacks permissions,
   *         or if the transaction fails.
   */
  setRateLimit(
    mint: PublicKey,
    remoteChainSelector: bigint,
    options: BurnMintSetRateLimitOptions // Use the more specific base options type
  ): Promise<string>;

  /**
   * Check if a token pool exists
   * @param mint Token mint
   */
  hasPool(mint: PublicKey): Promise<boolean>;

  /**
   * Check if a token pool has a chain configuration
   * @param mint Token mint
   * @param destChainSelector Destination chain selector
   */
  hasChainConfig(mint: PublicKey, destChainSelector: bigint): Promise<boolean>;

  /**
   * Get the account reader for this pool
   */
  getAccountReader(): TokenPoolAccountReader;

  /**
   * Propose transferring the admin role for a token pool to a new administrator.
   *
   * This is the first step in a two-step ownership transfer process.
   * The current administrator calls this function to propose a new owner.
   * The proposed new owner must then call `acceptAdminRole` to finalize the transfer.
   *
   * @param mint Token mint identifying the pool.
   * @param options Configuration options including the new admin address and transaction settings.
   * @returns A Promise resolving to the transaction signature string.
   * @throws Error if the caller is not the current owner or if the transaction fails.
   */
  transferAdminRole(
    mint: PublicKey,
    options: TransferAdminRoleOptions
  ): Promise<string>;

  /**
   * Accept the admin role for a token pool.
   *
   * This is the second step in a two-step ownership transfer process.
   * The proposed new administrator (set via `transferAdminRole`) calls this function
   * to finalize the transfer and become the new owner.
   *
   * @param mint Token mint identifying the pool.
   * @param options Optional transaction execution settings.
   * @returns A Promise resolving to the transaction signature string.
   * @throws Error if the caller is not the proposed owner or if the transaction fails.
   */
  acceptAdminRole(mint: PublicKey, options?: AcceptAdminRoleOptions): Promise<string>;

  /**
   * Sets the router address for the token pool.
   *
   * Only the current owner can call this.
   *
   * @param mint Token mint identifying the pool.
   * @param options Configuration options including the new router address and transaction settings.
   * @returns A Promise resolving to the transaction signature string.
   */
  setRouter(mint: PublicKey, options: SetRouterOptions): Promise<string>;

  /**
   * Appends additional remote pool addresses for a specific chain configuration.
   *
   * Use this if you need to recognize tokens sent from older versions of a pool on the remote chain.
   * Only the current owner can call this.
   *
   * @param mint Token mint identifying the pool.
   * @param options Configuration options including remote chain selector, addresses, and transaction settings.
   * @returns A Promise resolving to the transaction signature string.
   */
  appendRemotePoolAddresses(mint: PublicKey, options: AppendRemotePoolAddressesOptions): Promise<string>;

  /**
   * Deletes the configuration for a specific remote chain.
   *
   * This closes the chain config account and returns the rent to the owner.
   * Only the current owner can call this.
   *
   * @param mint Token mint identifying the pool.
   * @param options Configuration options including remote chain selector and transaction settings.
   * @returns A Promise resolving to the transaction signature string.
   */
  deleteChainConfig(mint: PublicKey, options: DeleteChainConfigOptions): Promise<string>;

  /**
   * Configures the sender allowlist for the token pool.
   *
   * Only the current owner can call this.
   *
   * @param mint Token mint identifying the pool.
   * @param options Configuration options including addresses to add, enabled flag, and transaction settings.
   * @returns A Promise resolving to the transaction signature string.
   */
  configureAllowlist(mint: PublicKey, options: ConfigureAllowlistOptions): Promise<string>;

  /**
   * Removes addresses from the sender allowlist for the token pool.
   *
   * Only the current owner can call this.
   *
   * @param mint Token mint identifying the pool.
   * @param options Configuration options including addresses to remove and transaction settings.
   * @returns A Promise resolving to the transaction signature string.
   */
  removeFromAllowlist(mint: PublicKey, options: RemoveFromAllowlistOptions): Promise<string>;

  /**
   * Initializes the state version of a pool if it's currently uninitialized (version 0).
   *
   * This is typically only needed for pools created before versioning was introduced.
   * This method is permissionless.
   *
   * @param mint Token mint identifying the pool.
   * @param options Optional transaction execution settings.
   * @returns A Promise resolving to the transaction signature string.
   */
  initializeStateVersion(mint: PublicKey, options?: InitializeStateVersionOptions): Promise<string>;
}
