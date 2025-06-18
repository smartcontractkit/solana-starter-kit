import { PublicKey } from "@solana/web3.js";
import { CCIPContext, TokenPoolChainConfigResponse } from "../../core/models";
import {
  TokenPoolAccountReader,
  TokenPoolRateLimit,
  TokenPoolInfo,
} from "../abstract";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import {
  findBurnMintPoolConfigPDA,
  findBurnMintPoolChainConfigPDA,
  findGlobalConfigPDA,
} from "../../utils/pdas/tokenpool";
import {
  RemoteAddress,
  StateFields as StateTypeFields,
  ChainConfigFields as ChainConfigTypeFields,
  BaseConfigFields,
  BaseChainFields,
  State as StateType,
  ChainConfig as ChainConfigType,
  PoolConfigFields as PoolConfigTypeFields,
  PoolConfig as PoolConfigType,
} from "../../burnmint-pool-bindings/types";

/**
 * Global configuration for burn-mint pools
 */
export type BurnMintGlobalConfig = PoolConfigTypeFields;

/**
 * Burn-mint pool configuration
 */
export type BurnMintPoolConfig = StateTypeFields;

/**
 * Chain configuration for burn-mint pools
 */
export type BurnMintChainConfig = ChainConfigTypeFields;

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
   * Fetches the global configuration for the burn-mint token pool program
   * @see TokenPoolAccountReader.getGlobalConfigInfo
   */
  async getGlobalConfigInfo(): Promise<BurnMintGlobalConfig> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(
        `Fetching global config for program: ${this.programId.toString()}`
      );
      const [pda, bump] = findGlobalConfigPDA(this.programId);
      this.logger.debug(`Global config PDA: ${pda.toString()} (bump: ${bump})`);
      this.logger.trace(
        `PDA derivation: seeds=[config], program=${this.programId.toString()}`
      );

      // Get account info to first check if it exists and is owned by our program
      this.logger.trace(
        `Fetching account info for global config PDA: ${pda.toString()}`
      );
      const accountInfo = await this.context.provider.connection.getAccountInfo(
        pda
      );

      if (!accountInfo) {
        this.logger.debug(
          `Global config account not found at PDA: ${pda.toString()}`
        );
        throw new Error(
          `Global config not found for program: ${this.programId.toString()}`
        );
      }

      this.logger.debug(
        `Global config account found: owner=${accountInfo.owner.toString()}, dataLength=${
          accountInfo.data.length
        }, lamports=${accountInfo.lamports}`
      );
      this.logger.trace(
        `Account data (first 32 bytes): ${accountInfo.data
          .slice(0, 32)
          .toString("hex")}`
      );

      // Verify account is owned by our program
      if (!accountInfo.owner.equals(this.programId)) {
        this.logger.debug(
          `Global config account owner mismatch: expected=${this.programId.toString()}, actual=${accountInfo.owner.toString()}`
        );
        throw new Error(
          `Global config account is not owned by program: ${this.programId.toString()}`
        );
      }

      // Decode the account data using borsh and the PoolConfig layout
      this.logger.trace(
        `Decoding global config data: discriminator=${accountInfo.data
          .slice(0, 8)
          .toString("hex")}`
      );
      const decoded = PoolConfigType.layout().decode(accountInfo.data.slice(8)); // Skip 8-byte discriminator
      this.logger.trace(
        `Raw decoded global config data: version=${decoded.version}`
      );
      const globalConfig = PoolConfigType.fromDecoded(decoded);

      if (!globalConfig) {
        throw new Error(
          `Failed to decode global config for program: ${this.programId.toString()}`
        );
      }

      this.logger.debug("Successfully decoded global config:", {
        version: globalConfig.version,
        selfServedAllowed: globalConfig.self_served_allowed,
      });
      this.logger.trace("Complete global config details:", globalConfig);

      return globalConfig;
    } catch (error) {
      throw enhanceError(error, {
        operation: "getGlobalConfigInfo",
        programId: this.programId.toString(),
      });
    }
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
      const [pda, bump] = findBurnMintPoolConfigPDA(mint, this.programId);
      this.logger.debug(`Pool config PDA: ${pda.toString()} (bump: ${bump})`);
      this.logger.trace(
        `PDA derivation: seeds=[ccip_tokenpool_config, ${mint.toString()}], program=${this.programId.toString()}`
      );

      // Get account info to first check if it exists and is owned by our program
      this.logger.trace(`Fetching account info for PDA: ${pda.toString()}`);
      const accountInfo = await this.context.provider.connection.getAccountInfo(
        pda
      );

      if (!accountInfo) {
        this.logger.debug(`Account not found at PDA: ${pda.toString()}`);
        throw new Error(
          `Burn-mint pool config not found for mint: ${mint.toString()}`
        );
      }

      this.logger.debug(
        `Account found: owner=${accountInfo.owner.toString()}, dataLength=${
          accountInfo.data.length
        }, lamports=${accountInfo.lamports}`
      );
      this.logger.trace(
        `Account data (first 32 bytes): ${accountInfo.data
          .slice(0, 32)
          .toString("hex")}`
      );

      // Verify account is owned by our program
      if (!accountInfo.owner.equals(this.programId)) {
        this.logger.debug(
          `Account owner mismatch: expected=${this.programId.toString()}, actual=${accountInfo.owner.toString()}`
        );
        throw new Error(
          `Account is not owned by program: ${this.programId.toString()}`
        );
      }

      // Decode the account data using borsh and the State layout
      this.logger.trace(
        `Decoding account data: discriminator=${accountInfo.data
          .slice(0, 8)
          .toString("hex")}`
      );
      const decoded = StateType.layout().decode(accountInfo.data.slice(8)); // Skip 8-byte discriminator
      this.logger.trace(`Raw decoded data: version=${decoded.version}`);
      const poolConfig = StateType.fromDecoded(decoded);

      if (!poolConfig) {
        throw new Error(
          `Failed to decode pool config for mint: ${mint.toString()}`
        );
      }

      this.logger.debug("Successfully decoded pool config:", {
        version: poolConfig.version,
        mint: poolConfig.config.mint.toString(),
        owner: poolConfig.config.owner.toString(),
        decimals: poolConfig.config.decimals,
        router: poolConfig.config.router.toString(),
      });
      this.logger.trace("Complete pool config details:", {
        version: poolConfig.version,
        tokenProgram: poolConfig.config.token_program.toString(),
        mint: poolConfig.config.mint.toString(),
        decimals: poolConfig.config.decimals,
        poolSigner: poolConfig.config.pool_signer.toString(),
        poolTokenAccount: poolConfig.config.pool_token_account.toString(),
        owner: poolConfig.config.owner.toString(),
        proposedOwner: poolConfig.config.proposed_owner.toString(),
        rateLimitAdmin: poolConfig.config.rate_limit_admin.toString(),
        routerOnrampAuthority:
          poolConfig.config.router_onramp_authority.toString(),
        router: poolConfig.config.router.toString(),
        rebalancer: poolConfig.config.rebalancer.toString(),
        canAcceptLiquidity: poolConfig.config.can_accept_liquidity,
        listEnabled: poolConfig.config.list_enabled,
        allowListLength: poolConfig.config.allow_list.length,
        rmnRemote: poolConfig.config.rmn_remote.toString(),
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
      const [pda, bump] = findBurnMintPoolChainConfigPDA(
        remoteChainSelector,
        mint,
        this.programId
      );
      this.logger.debug(`Chain config PDA: ${pda.toString()} (bump: ${bump})`);
      this.logger.trace(
        `PDA derivation: seeds=[ccip_tokenpool_chainconfig, ${remoteChainSelector.toString()}, ${mint.toString()}], program=${this.programId.toString()}`
      );

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

      // Decode the account data using borsh and the ChainConfig layout
      const decoded = ChainConfigType.layout().decode(
        accountInfo.data.slice(8)
      ); // Skip 8-byte discriminator
      const chainConfigAccount = ChainConfigType.fromDecoded(decoded);

      if (!chainConfigAccount) {
        throw new Error(
          `Failed to decode chain config for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
        );
      }

      this.logger.trace("Retrieved raw chain config:", {
        decimals: chainConfigAccount.base.remote.decimals,
        tokenAddress:
          chainConfigAccount.base.remote.token_address.address.toString(),
        poolAddressesCount:
          chainConfigAccount.base.remote.pool_addresses.length,
        // Rate limit info
        inboundRateLimit: {
          enabled: chainConfigAccount.base.inbound_rate_limit.cfg.enabled,
          capacity:
            chainConfigAccount.base.inbound_rate_limit.cfg.capacity.toString(),
        },
        outboundRateLimit: {
          enabled: chainConfigAccount.base.outbound_rate_limit.cfg.enabled,
          capacity:
            chainConfigAccount.base.outbound_rate_limit.cfg.capacity.toString(),
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
    chainConfigAccount: ChainConfigTypeFields,
    accountAddress: PublicKey
  ): TokenPoolChainConfigResponse {
    return {
      address: accountAddress.toString(),
      base: {
        decimals: chainConfigAccount.base.remote.decimals,
        poolAddresses: chainConfigAccount.base.remote.pool_addresses.map(
          (addr: RemoteAddress) => ({
            address: Buffer.from(addr.address).toString("hex"),
          })
        ),
        tokenAddress: {
          address: Buffer.from(
            chainConfigAccount.base.remote.token_address.address
          ).toString("hex"),
        },
        inboundRateLimit: {
          isEnabled: chainConfigAccount.base.inbound_rate_limit.cfg.enabled,
          capacity: BigInt(
            chainConfigAccount.base.inbound_rate_limit.cfg.capacity.toString()
          ),
          rate: BigInt(
            chainConfigAccount.base.inbound_rate_limit.cfg.rate.toString()
          ),
          lastTxTimestamp: BigInt(
            chainConfigAccount.base.inbound_rate_limit.last_updated.toString()
          ),
          currentBucketValue: BigInt(
            chainConfigAccount.base.inbound_rate_limit.tokens.toString()
          ),
        },
        outboundRateLimit: {
          isEnabled: chainConfigAccount.base.outbound_rate_limit.cfg.enabled,
          capacity: BigInt(
            chainConfigAccount.base.outbound_rate_limit.cfg.capacity.toString()
          ),
          rate: BigInt(
            chainConfigAccount.base.outbound_rate_limit.cfg.rate.toString()
          ),
          lastTxTimestamp: BigInt(
            chainConfigAccount.base.outbound_rate_limit.last_updated.toString()
          ),
          currentBucketValue: BigInt(
            chainConfigAccount.base.outbound_rate_limit.tokens.toString()
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
