/**
 * Pool Information Script (CLI Framework Version)
 *
 * This script retrieves and displays comprehensive information about a burn-mint token pool.
 * It shows all configuration details, ownership information, and status.
 */

import { PublicKey } from "@solana/web3.js";
import { 
  TokenPoolManager,
  TokenPoolType,
  LogLevel,
  createLogger,
  TokenPoolClient,
} from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import {
  findBurnMintPoolConfigPDA,
  findGlobalConfigPDA,
} from "../../../ccip-lib/svm/utils/pdas/tokenpool";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for pool info operations
 */
const POOL_INFO_CONFIG = {
  defaultLogLevel: LogLevel.INFO,
  separatorLength: 80,
  subSeparatorLength: 40,
};

/**
 * Options specific to the get-pool-info command
 */
interface GetPoolInfoOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
}

/**
 * Pool Information Command
 */
class GetPoolInfoCommand extends CCIPCommand<GetPoolInfoOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "get-pool-info",
      description: "🏊 CCIP Pool Information Viewer\\n\\nRetrieves and displays comprehensive information about a burn-mint token pool. Shows all configuration details, ownership information, and status.",
      examples: [
        "# Get pool info for a token",
        "yarn svm:pool:get-info --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh",
        "",
        "# With debug logging",
        "yarn svm:pool:get-info --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --log-level DEBUG"
      ],
      notes: [
        "This script provides comprehensive information about an existing pool",
        "All addresses and configuration details are displayed",
        "Suggestions for next steps are provided",
        "Pool must be initialized before running this script",
        "Wallet is used for querying purposes only (no transactions)",
        "Shows global configuration and pool-specific settings"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "token-mint",
        required: true,
        type: "string",
        description: "Token mint address to get info for",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      }
    ];
  }

  /**
   * Validate pool info configuration
   */
  private validateConfig(): { tokenMint: PublicKey; burnMintPoolProgramId: PublicKey } {
    const errors: string[] = [];

    // Validate token mint address
    let tokenMint: PublicKey;
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch {
      errors.push("Invalid token mint address format");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    // Validate burn-mint pool program ID
    let burnMintPoolProgramId: PublicKey;
    try {
      burnMintPoolProgramId = new PublicKey(this.options.burnMintPoolProgram);
    } catch {
      errors.push("Invalid burn-mint pool program ID format");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`
      );
    }

    return { tokenMint, burnMintPoolProgramId };
  }

  /**
   * Format a PublicKey for display, showing if it's a default/empty key
   */
  private formatPublicKey(key: PublicKey, label?: string): string {
    const keyStr = key.toString();
    const isDefault = key.equals(PublicKey.default);
    const suffix = isDefault ? " (default/unset)" : "";
    return label ? `${label}: ${keyStr}${suffix}` : `${keyStr}${suffix}`;
  }

  /**
   * Format boolean values with visual indicators
   */
  private formatBoolean(value: boolean): string {
    return value ? "✅ Enabled" : "❌ Disabled";
  }

  /**
   * Check if pool exists and get basic status
   */
  private async checkPoolExistence(
    tokenMint: PublicKey,
    burnMintPoolProgramId: PublicKey,
    tokenPoolClient: TokenPoolClient
  ): Promise<boolean> {
    this.logger.info("Checking if pool exists...");
    this.logger.debug(`Checking pool existence for mint: ${tokenMint.toString()}`);
    
    const poolExists = await tokenPoolClient.hasPool(tokenMint);
    this.logger.debug(`Pool exists: ${poolExists}`);

    if (!poolExists) {
      this.logger.info("\\n❌ Pool does not exist for this token mint");
      this.logger.info("\\n💡 Run the initialization script first:");
      this.logger.info(
        `yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
      this.logger.debug("Pool not found - terminating script");
      return false;
    }

    return true;
  }

  /**
   * Get global configuration information
   */
  private async getGlobalConfigInfo(tokenPoolClient: TokenPoolClient): Promise<any> {
    this.logger.debug("Fetching global configuration...");
    
    try {
      const globalConfigInfo = await tokenPoolClient.getGlobalConfigInfo();
      this.logger.debug("Global config retrieved:", {
        version: globalConfigInfo.config.version,
        selfServedAllowed: globalConfigInfo.config.self_served_allowed,
      });
      this.logger.trace("Complete global config:", globalConfigInfo);
      return globalConfigInfo;
    } catch (error) {
      this.logger.debug(`Failed to fetch global config: ${error}`);
      return {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Display comprehensive pool information
   */
  private displayPoolInfo(
    poolInfo: BurnMintTokenPoolInfo,
    globalConfigInfo: any,
    tokenMint: PublicKey,
    burnMintPoolProgramId: PublicKey
  ): void {
    // Header
    this.logger.info("\\n" + "=".repeat(POOL_INFO_CONFIG.separatorLength));
    this.logger.info("🏊 BURN-MINT TOKEN POOL INFORMATION");
    this.logger.info("=".repeat(POOL_INFO_CONFIG.separatorLength));

    // Global Configuration
    this.logger.info("\\n🌍 GLOBAL CONFIGURATION");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    if (globalConfigInfo && globalConfigInfo.config) {
      this.logger.info(`Program Version: ${globalConfigInfo.config.version}`);
      this.logger.info(
        `Self-Served Pools: ${this.formatBoolean(
          globalConfigInfo.config.self_served_allowed
        )}`
      );
    } else {
      this.logger.info("❌ Global config not found or not initialized");
      this.logger.info("💡 Run: yarn svm:pool:init-global-config first");
    }

    // Basic Pool Info
    this.logger.info("\\n📋 BASIC INFORMATION");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    this.logger.info(`Pool Type: ${poolInfo.poolType}`);
    this.logger.info(`Version: ${poolInfo.config.version}`);
    this.logger.info(this.formatPublicKey(poolInfo.config.config.mint, "Token Mint"));
    this.logger.info(`Decimals: ${poolInfo.config.config.decimals}`);

    // Ownership & Permissions
    this.logger.info("\\n👥 OWNERSHIP & PERMISSIONS");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    this.logger.info(this.formatPublicKey(poolInfo.config.config.owner, "Current Owner"));
    this.logger.info(
      this.formatPublicKey(poolInfo.config.config.proposedOwner, "Proposed Owner")
    );
    this.logger.info(
      this.formatPublicKey(poolInfo.config.config.rateLimitAdmin, "Rate Limit Admin")
    );

    // Token Configuration
    this.logger.info("\\n🪙 TOKEN CONFIGURATION");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    this.logger.info(
      this.formatPublicKey(poolInfo.config.config.tokenProgram, "Token Program")
    );
    this.logger.info(
      this.formatPublicKey(poolInfo.config.config.poolSigner, "Pool Signer PDA")
    );
    this.logger.info(
      this.formatPublicKey(
        poolInfo.config.config.poolTokenAccount,
        "Pool Token Account"
      )
    );

    // CCIP Integration
    this.logger.info("\\n🌉 CCIP INTEGRATION");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    this.logger.info(this.formatPublicKey(poolInfo.config.config.router, "CCIP Router"));
    this.logger.info(
      this.formatPublicKey(
        poolInfo.config.config.routerOnrampAuthority,
        "Router Onramp Authority"
      )
    );
    this.logger.info(
      this.formatPublicKey(poolInfo.config.config.rmnRemote, "RMN Remote")
    );

    // Security & Controls
    this.logger.info("\\n🔒 SECURITY & CONTROLS");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    this.logger.info(
      `Allowlist: ${this.formatBoolean(poolInfo.config.config.listEnabled)}`
    );
    if (
      poolInfo.config.config.listEnabled &&
      poolInfo.config.config.allowList.length > 0
    ) {
      this.logger.info(
        `Allowlist Entries (${poolInfo.config.config.allowList.length}):`
      );
      poolInfo.config.config.allowList.forEach((addr, index) => {
        this.logger.info(`  ${index + 1}. ${addr.toString()}`);
      });
    } else if (poolInfo.config.config.listEnabled) {
      this.logger.info(
        "  ⚠️  Allowlist is enabled but empty - no addresses can transfer"
      );
    }

    // Rebalancing (for reference, not used in burn-mint pools)
    this.logger.info("\\n⚖️ REBALANCING (Lock/Release Only)");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    this.logger.info(
      this.formatPublicKey(poolInfo.config.config.rebalancer, "Rebalancer")
    );
    this.logger.info(
      `Can Accept Liquidity: ${this.formatBoolean(
        poolInfo.config.config.canAcceptLiquidity
      )}`
    );

    // Address Summary
    this.logger.info("\\n📍 ADDRESS SUMMARY");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));

    // Derive important PDAs for the summary
    const [poolConfigPDA] = findBurnMintPoolConfigPDA(
      tokenMint,
      burnMintPoolProgramId
    );
    const [globalConfigPDA] = findGlobalConfigPDA(burnMintPoolProgramId);

    this.logger.info(`Token Mint:           ${tokenMint.toString()}`);
    this.logger.info(`Pool Program:         ${burnMintPoolProgramId.toString()}`);
    this.logger.info(
      `Pool Config PDA:      ${poolConfigPDA.toString()}  (Pool state account)`
    );
    this.logger.info(
      `Global Config PDA:    ${globalConfigPDA.toString()}  (Program global config)`
    );
    this.logger.info(
      `Pool Owner:           ${poolInfo.config.config.owner.toString()}`
    );
    this.logger.info(
      `Pool Signer PDA:      ${poolInfo.config.config.poolSigner.toString()}  (Token authority)`
    );

    this.logger.info("\\n" + "=".repeat(POOL_INFO_CONFIG.separatorLength));
    this.logger.info("✅ Pool information retrieved successfully!");

    // Next steps suggestions
    this.logger.info("\\n💡 NEXT STEPS");
    this.logger.info("-".repeat(POOL_INFO_CONFIG.subSeparatorLength));
    this.logger.info("• Configure remote chains for cross-chain transfers");
    this.logger.info("• Set up rate limits for security");
    this.logger.info("• Configure allowlists if needed");
    this.logger.info("• Transfer ownership if this is a temporary deployer");
  }

  protected async execute(): Promise<void> {
    this.logger.info("🏊 CCIP Token Pool Information");
    this.logger.info("===========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (for querying purposes)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Querying as: ${walletKeypair.publicKey.toString()}`);

    // Validate configuration and parse parameters
    const { tokenMint, burnMintPoolProgramId } = this.validateConfig();

    this.logger.info("");
    this.logger.info("⚙️  QUERY CONFIGURATION");
    this.logger.info("===========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Program ID: ${burnMintPoolProgramId.toString()}`);

    this.logger.debug("");
    this.logger.debug("🔍 CONFIGURATION DETAILS");
    this.logger.debug("===========================================");
    this.logger.debug(`Network: ${config.id}`);
    this.logger.debug(`Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`Log level: ${this.options.logLevel}`);
    this.logger.debug(`Wallet: ${walletKeypair.publicKey.toString()}`);

    try {
      // Create token pool manager using SDK
      const programIds = { burnMint: burnMintPoolProgramId };
      const tokenPoolManager = TokenPoolManager.create(
        config.connection,
        walletKeypair,
        programIds,
        {
          ccipRouterProgramId: config.routerProgramId.toString(),
          feeQuoterProgramId: config.feeQuoterProgramId.toString(),
          rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
          linkTokenMint: config.linkTokenMint.toString(),
          receiverProgramId: config.receiverProgramId.toString(),
        },
        { logLevel: this.options.logLevel ?? POOL_INFO_CONFIG.defaultLogLevel }
      );

      const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

      // Check if pool exists
      this.logger.info("");
      this.logger.info("🔍 POOL EXISTENCE CHECK");
      this.logger.info("===========================================");
      const poolExists = await this.checkPoolExistence(
        tokenMint,
        burnMintPoolProgramId,
        tokenPoolClient
      );

      if (!poolExists) {
        return;
      }

      // Get pool information
      this.logger.info("");
      this.logger.info("📊 FETCHING POOL DATA");
      this.logger.info("===========================================");
      this.logger.info("Fetching pool information...");
      this.logger.debug("Retrieving complete pool configuration...");
      
      const poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
      this.logger.debug("Pool info retrieved:", {
        poolType: poolInfo.poolType,
        version: poolInfo.config.version,
        owner: poolInfo.config.config.owner.toString(),
        mint: poolInfo.config.config.mint.toString(),
        decimals: poolInfo.config.config.decimals,
      });
      this.logger.trace("Complete pool info:", poolInfo);

      // Get global config information
      const globalConfigInfo = await this.getGlobalConfigInfo(tokenPoolClient);

      // Display comprehensive pool information
      this.displayPoolInfo(poolInfo, globalConfigInfo, tokenMint, burnMintPoolProgramId);

    } catch (error) {
      this.logger.error("Failed to get pool info:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          this.logger.info("\\n❌ Pool not found");
          this.logger.info(
            "The pool may not be initialized yet or the addresses may be incorrect."
          );
        } else if (error.message.includes("Account is not owned")) {
          this.logger.info("\\n❌ Invalid program ID");
          this.logger.info(
            "The account exists but is not owned by the specified program."
          );
        }
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new GetPoolInfoCommand();
command.run().catch((error) => {
  process.exit(1);
});