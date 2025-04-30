import { PublicKey } from "@solana/web3.js";
import { CCIPContext, TokenPoolChainConfigResponse } from "../../core/models";
import { TokenPoolAccountReader, TokenPoolRateLimit, TokenPoolInfo } from "../abstract";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import {
  findBurnMintPoolConfigPDA,
  findBurnMintPoolChainConfigPDA,
} from "../../utils/pdas/tokenpool";
import {
  State,
  StateFields,
  ChainConfig,
  ChainConfigFields,
} from "../../burnmint-pool-bindings/accounts";
import { RemoteAddress } from "../../burnmint-pool-bindings/types";

/**
 * Burn-mint pool configuration
 */
export type BurnMintPoolConfig = StateFields;

/**
 * Chain configuration for burn-mint pools
 */
export type BurnMintChainConfig = ChainConfigFields;

/**
 * Complete information for a burn-mint token pool
 */
export interface BurnMintTokenPoolInfo extends TokenPoolInfo {
  config: BurnMintPoolConfig;
}

/**
 * Account reader for burn-mint token pools
 */
export class BurnMintTokenPoolAccountReader implements TokenPoolAccountReader {
  readonly programId: PublicKey;
  private readonly logger: Logger;

  /**
   * Creates a new BurnMintTokenPoolAccountReader
   * @param context CCIP context
   * @param programId Burn-mint token pool program ID
   */
  constructor(readonly context: CCIPContext, programId: PublicKey) {
    this.logger =
      context.logger ??
      createLogger("burnmint-pool-reader", { level: LogLevel.INFO });

    // Use provided program ID
    this.programId = programId;

    this.logger.debug(
      `BurnMintTokenPoolAccountReader initialized: programId=${this.programId.toString()}`
    );
  }

  /**
   * Fetches a burn-mint pool config account
   * @see TokenPoolAccountReader.getPoolConfig
   */
  async getPoolConfig(mint: PublicKey): Promise<BurnMintPoolConfig> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(
        `Fetching burn-mint pool config for mint: ${mint.toString()}`
      );
      const [pda] = findBurnMintPoolConfigPDA(mint, this.programId);
      this.logger.trace(`Pool config PDA: ${pda.toString()}`);

      // Use the generated account fetch method
      const poolConfig = await State.fetch(
        this.context.provider.connection,
        pda,
        this.programId
      );

      if (!poolConfig) {
        throw new Error(
          `Burn-mint pool config not found for mint: ${mint.toString()}`
        );
      }

      this.logger.trace("Retrieved burn-mint pool config:", {
        mint: poolConfig.config.mint.toString(),
        owner: poolConfig.config.owner.toString(),
        version: poolConfig.version,
      });

      return poolConfig;
    } catch (error) {
      throw enhanceError(error, {
        operation: "getPoolConfig",
        mint: mint.toString(),
        programId: this.programId.toString(),
      });
    }
  }

  /**
   * Fetches a chain configuration for a burn-mint token pool
   * @see TokenPoolAccountReader.getChainConfig
   * @param mint Token mint address to query
   * @param remoteChainSelector Remote chain selector
   * @returns Chain configuration in user-friendly format
   */
  async getChainConfig(
    mint: PublicKey,
    remoteChainSelector: bigint
  ): Promise<TokenPoolChainConfigResponse> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(
        `Fetching chain config for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
      );
      const [pda] = findBurnMintPoolChainConfigPDA(
        remoteChainSelector,
        mint,
        this.programId
      );
      this.logger.trace(`Chain config PDA: ${pda.toString()}`);

      // Get account info to first check if it exists and is owned by our program
      const accountInfo = await this.context.provider.connection.getAccountInfo(
        pda
      );

      if (!accountInfo) {
        throw new Error(
          `Chain config not found for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
        );
      }

      // Verify account is owned by our program
      if (!accountInfo.owner.equals(this.programId)) {
        throw new Error(
          `Account for selector ${remoteChainSelector.toString()} is not owned by program: ${this.programId.toString()}`
        );
      }

      // Decode the account data
      const chainConfigAccount = ChainConfig.decode(accountInfo.data);

      if (!chainConfigAccount) {
        throw new Error(
          `Failed to decode chain config for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
        );
      }

      this.logger.trace("Retrieved raw chain config:", {
        decimals: chainConfigAccount.base.remote.decimals,
        tokenAddress:
          chainConfigAccount.base.remote.tokenAddress.address.toString(),
        poolAddressesCount: chainConfigAccount.base.remote.poolAddresses.length,
        // Rate limit info
        inboundRateLimit: {
          enabled: chainConfigAccount.base.inboundRateLimit.cfg.enabled,
          capacity:
            chainConfigAccount.base.inboundRateLimit.cfg.capacity.toString(),
        },
        outboundRateLimit: {
          enabled: chainConfigAccount.base.outboundRateLimit.cfg.enabled,
          capacity:
            chainConfigAccount.base.outboundRateLimit.cfg.capacity.toString(),
        },
      });

      // Format and log the response
      const formattedConfig = this.formatChainConfig(chainConfigAccount, pda);
      this.logger.trace("Formatted chain config response:", {
        address: formattedConfig.address,
        decimals: formattedConfig.base.decimals,
        tokenAddress: formattedConfig.base.tokenAddress.address,
        poolAddressesCount: formattedConfig.base.poolAddresses.length,
        inboundRateLimit: {
          isEnabled: formattedConfig.base.inboundRateLimit.isEnabled,
          capacity: formattedConfig.base.inboundRateLimit.capacity,
          rate: formattedConfig.base.inboundRateLimit.rate,
          lastTxTimestamp:
            formattedConfig.base.inboundRateLimit.lastTxTimestamp,
          currentBucketValue:
            formattedConfig.base.inboundRateLimit.currentBucketValue,
        },
        outboundRateLimit: {
          isEnabled: formattedConfig.base.outboundRateLimit.isEnabled,
          capacity: formattedConfig.base.outboundRateLimit.capacity,
          rate: formattedConfig.base.outboundRateLimit.rate,
          lastTxTimestamp:
            formattedConfig.base.outboundRateLimit.lastTxTimestamp,
          currentBucketValue:
            formattedConfig.base.outboundRateLimit.currentBucketValue,
        },
      });

      return formattedConfig;
    } catch (error) {
      throw enhanceError(error, {
        operation: "getChainConfig",
        mint: mint.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        programId: this.programId.toString(),
      });
    }
  }

  /**
   * Converts a ChainConfig from Anchor bindings to a user-friendly format
   * @param chainConfigAccount The chain config account from Anchor bindings
   * @param accountAddress The public key of the chain config account
   * @returns A user-friendly representation of the chain config
   * @private Internal helper method
   */
  private formatChainConfig(
    chainConfigAccount: ChainConfigFields,
    accountAddress: PublicKey
  ): TokenPoolChainConfigResponse {
    return {
      address: accountAddress.toString(),
      base: {
        decimals: chainConfigAccount.base.remote.decimals,
        poolAddresses: chainConfigAccount.base.remote.poolAddresses.map(
          (addr: RemoteAddress) => ({
            address: Buffer.from(addr.address).toString("hex"),
          })
        ),
        tokenAddress: {
          address: Buffer.from(
            chainConfigAccount.base.remote.tokenAddress.address
          ).toString("hex"),
        },
        inboundRateLimit: {
          isEnabled: chainConfigAccount.base.inboundRateLimit.cfg.enabled,
          capacity: BigInt(
            chainConfigAccount.base.inboundRateLimit.cfg.capacity.toString()
          ),
          rate: BigInt(
            chainConfigAccount.base.inboundRateLimit.cfg.rate.toString()
          ),
          lastTxTimestamp: BigInt(
            chainConfigAccount.base.inboundRateLimit.lastUpdated.toString()
          ),
          currentBucketValue: BigInt(
            chainConfigAccount.base.inboundRateLimit.tokens.toString()
          ),
        },
        outboundRateLimit: {
          isEnabled: chainConfigAccount.base.outboundRateLimit.cfg.enabled,
          capacity: BigInt(
            chainConfigAccount.base.outboundRateLimit.cfg.capacity.toString()
          ),
          rate: BigInt(
            chainConfigAccount.base.outboundRateLimit.cfg.rate.toString()
          ),
          lastTxTimestamp: BigInt(
            chainConfigAccount.base.outboundRateLimit.lastUpdated.toString()
          ),
          currentBucketValue: BigInt(
            chainConfigAccount.base.outboundRateLimit.tokens.toString()
          ),
        },
      },
    };
  }

  /**
   * Implementation of the TokenPoolAccountReader interface
   * Returns rate limit configuration for a specific chain
   * @see TokenPoolAccountReader.getRateLimitConfigForChain
   */
  async getRateLimitConfigForChain(
    mint: PublicKey,
    remoteChainSelector: bigint
  ): Promise<TokenPoolRateLimit> {
    try {
      // Get the chain config for the specified selector
      const chainConfig = await this.getChainConfig(mint, remoteChainSelector);

      // Return rate limits with both inbound and outbound information
      // This maintains interface compatibility while adding extra information
      return {
        mint,
        outbound: {
          capacity: chainConfig.base.outboundRateLimit.capacity,
          rate: chainConfig.base.outboundRateLimit.rate,
          consumed: chainConfig.base.outboundRateLimit.currentBucketValue,
          lastUpdated: chainConfig.base.outboundRateLimit.lastTxTimestamp,
          isEnabled: chainConfig.base.outboundRateLimit.isEnabled,
        },
        inbound: {
          capacity: chainConfig.base.inboundRateLimit.capacity,
          rate: chainConfig.base.inboundRateLimit.rate,
          consumed: chainConfig.base.inboundRateLimit.currentBucketValue,
          lastUpdated: chainConfig.base.inboundRateLimit.lastTxTimestamp,
          isEnabled: chainConfig.base.inboundRateLimit.isEnabled,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get rate limit for chain ${remoteChainSelector.toString()}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Implementation of the TokenPoolAccountReader interface
   * Returns rate limit configurations for multiple chains
   * @see TokenPoolAccountReader.getRateLimitConfigsForChains
   */
  async getRateLimitConfigsForChains(
    mint: PublicKey,
    remoteChainSelectors: bigint[]
  ): Promise<TokenPoolRateLimit[]> {
    if (remoteChainSelectors.length === 0) {
      throw new Error("Chain selectors must be provided");
    }

    try {
      // Get chain configs for the specified selectors
      const chainConfigs = await this.listChainConfigs(
        mint,
        remoteChainSelectors
      );

      // Map chain configs to rate limits
      return chainConfigs.map((chainConfig) => ({
        mint,
        outbound: {
          capacity: chainConfig.base.outboundRateLimit.capacity,
          rate: chainConfig.base.outboundRateLimit.rate,
          consumed: chainConfig.base.outboundRateLimit.currentBucketValue,
          lastUpdated: chainConfig.base.outboundRateLimit.lastTxTimestamp,
          isEnabled: chainConfig.base.outboundRateLimit.isEnabled,
        },
        inbound: {
          capacity: chainConfig.base.inboundRateLimit.capacity,
          rate: chainConfig.base.inboundRateLimit.rate,
          consumed: chainConfig.base.inboundRateLimit.currentBucketValue,
          lastUpdated: chainConfig.base.inboundRateLimit.lastTxTimestamp,
          isEnabled: chainConfig.base.inboundRateLimit.isEnabled,
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to get rate limits for chains: ${error}`);
      throw error;
    }
  }

  /**
   * Helper method to list chain configurations for a token mint
   * @see TokenPoolAccountReader.listChainConfigs
   */
  async listChainConfigs(
    mint: PublicKey,
    remoteChainSelectors: bigint[] = []
  ): Promise<TokenPoolChainConfigResponse[]> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(`Listing chain configs for mint: ${mint.toString()}`);

      // Validate that chain selectors are provided
      if (!remoteChainSelectors || remoteChainSelectors.length === 0) {
        throw new Error("Chain selectors array cannot be empty");
      }

      this.logger.debug(
        `Checking ${remoteChainSelectors.length} chain selectors`
      );

      const chainConfigs: TokenPoolChainConfigResponse[] = [];

      // Fetch chain configs for each selector using getChainConfig
      for (const remoteChainSelector of remoteChainSelectors) {
        try {
          const chainConfig = await this.getChainConfig(
            mint,
            remoteChainSelector
          );
          chainConfigs.push(chainConfig);
          this.logger.trace(
            `Found chain config for mint ${mint.toString()} with selector ${remoteChainSelector.toString()}`
          );
        } catch (error) {
          // Log error but continue to next selector
          this.logger.trace(
            `Error checking chain config for selector ${remoteChainSelector.toString()}: ${error}`
          );
        }
      }

      this.logger.info(
        `Found ${
          chainConfigs.length
        } chain configs for mint: ${mint.toString()}`
      );

      return chainConfigs;
    } catch (error) {
      throw enhanceError(error, {
        operation: "listChainConfigs",
        mint: mint.toString(),
        programId: this.programId.toString(),
      });
    }
  }
}
