/**
 * Pool Information Script
 *
 * This script retrieves and displays comprehensive information about a burn-mint token pool.
 * It shows all configuration details, ownership information, and status.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have the required token mint and program ID
 * 2. Run the script with: yarn svm:pool:get-info
 *
 * Required arguments:
 * --token-mint              : Token mint address to get info for
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 *
 * Example usage:
 * yarn svm:pool:get-info --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh
 */

import { PublicKey } from "@solana/web3.js";
import { 
  TokenPoolManager,
  TokenPoolType,
  LogLevel,
  createLogger,
} from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { ChainId, getCCIPSVMConfig } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import {
  findBurnMintPoolConfigPDA,
  findGlobalConfigPDA,
} from "../../../ccip-lib/svm/utils/pdas/tokenpool";

/**
 * Parse command line arguments specific to pool info
 */
function parsePoolInfoArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let tokenMint: string | undefined;
  let burnMintPoolProgram: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--token-mint":
        if (i + 1 < args.length) {
          tokenMint = args[i + 1];
          i++;
        }
        break;
      case "--burn-mint-pool-program":
        if (i + 1 < args.length) {
          burnMintPoolProgram = args[i + 1];
          i++;
        }
        break;
    }
  }

  return {
    ...commonArgs,
    tokenMint,
    burnMintPoolProgram,
  };
}

/**
 * Format a PublicKey for display, showing if it's a default/empty key
 */
function formatPublicKey(key: PublicKey, label?: string): string {
  const keyStr = key.toString();
  const isDefault = key.equals(PublicKey.default);
  const suffix = isDefault ? " (default/unset)" : "";
  return label ? `${label}: ${keyStr}${suffix}` : `${keyStr}${suffix}`;
}

/**
 * Format boolean values with visual indicators
 */
function formatBoolean(value: boolean): string {
  return value ? "✅ Enabled" : "❌ Disabled";
}

async function main() {
  // Parse arguments
  const options = parsePoolInfoArgs();

  // Check for help
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  // Validate required arguments
  if (!options.tokenMint) {
    console.error("Error: --token-mint is required");
    printUsage();
    process.exit(1);
  }

  if (!options.burnMintPoolProgram) {
    console.error("Error: --burn-mint-pool-program is required");
    printUsage();
    process.exit(1);
  }

  // Create logger
  const logger = createLogger("pool-info", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("🏊 CCIP Token Pool Information");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

  // Get keypair path and load wallet (for logging purposes)
  const keypairPath = getKeypairPath(options);
  logger.info(`Using keypair from ${keypairPath}...`);

  try {
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Querying as: ${walletKeypair.publicKey.toString()}`);

    // Parse addresses
    const tokenMint = new PublicKey(options.tokenMint);
    const burnMintPoolProgramId = new PublicKey(options.burnMintPoolProgram);

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Program ID: ${burnMintPoolProgramId.toString()}`);

    logger.debug(`Query configuration:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Log level: ${options.logLevel}`);
    logger.debug(`  Wallet: ${walletKeypair.publicKey.toString()}`);

    // Create token pool manager directly using SDK
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
      { logLevel: options.logLevel ?? LogLevel.INFO }
    );

    const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

    // Check if pool exists
    logger.info("Checking if pool exists...");
    logger.debug(`Checking pool existence for mint: ${tokenMint.toString()}`);
    const poolExists = await tokenPoolClient.hasPool(tokenMint);
    logger.debug(`Pool exists: ${poolExists}`);

    if (!poolExists) {
      logger.info("\n❌ Pool does not exist for this token mint");
      logger.info("\n💡 Run the initialization script first:");
      logger.info(
        `yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
      logger.debug("Pool not found - terminating script");
      return;
    }

    // Get pool information
    logger.info("Fetching pool information...");
    logger.debug("Retrieving complete pool configuration...");
    const poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
    logger.debug("Pool info retrieved:", {
      poolType: poolInfo.poolType,
      version: poolInfo.config.version,
      owner: poolInfo.config.config.owner.toString(),
      mint: poolInfo.config.config.mint.toString(),
      decimals: poolInfo.config.config.decimals,
    });
    logger.trace("Complete pool info:", poolInfo);

    // Get global config information
    logger.debug("Fetching global configuration...");
    let globalConfigInfo = null;
    try {
      globalConfigInfo = await tokenPoolClient.getGlobalConfigInfo();
      logger.debug("Global config retrieved:", {
        version: globalConfigInfo.config.version,
        selfServedAllowed: globalConfigInfo.config.self_served_allowed,
      });
      logger.trace("Complete global config:", globalConfigInfo);
    } catch (error) {
      logger.debug(`Failed to fetch global config: ${error}`);
      globalConfigInfo = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Display comprehensive pool information
    logger.info("\n" + "=".repeat(80));
    logger.info("🏊 BURN-MINT TOKEN POOL INFORMATION");
    logger.info("=".repeat(80));

    // Global Configuration
    logger.info("\n🌍 GLOBAL CONFIGURATION");
    logger.info("-".repeat(40));
    if (globalConfigInfo && globalConfigInfo.config) {
      logger.info(`Program Version: ${globalConfigInfo.config.version}`);
      logger.info(
        `Self-Served Pools: ${formatBoolean(
          globalConfigInfo.config.self_served_allowed
        )}`
      );
    } else {
      logger.info("❌ Global config not found or not initialized");
      logger.info("💡 Run: yarn svm:pool:init-global-config first");
    }

    // Basic Pool Info
    logger.info("\n📋 BASIC INFORMATION");
    logger.info("-".repeat(40));
    logger.info(`Pool Type: ${poolInfo.poolType}`);
    logger.info(`Version: ${poolInfo.config.version}`);
    logger.info(formatPublicKey(poolInfo.config.config.mint, "Token Mint"));
    logger.info(`Decimals: ${poolInfo.config.config.decimals}`);

    // Ownership & Permissions
    logger.info("\n👥 OWNERSHIP & PERMISSIONS");
    logger.info("-".repeat(40));
    logger.info(formatPublicKey(poolInfo.config.config.owner, "Current Owner"));
    logger.info(
      formatPublicKey(poolInfo.config.config.proposedOwner, "Proposed Owner")
    );
    logger.info(
      formatPublicKey(poolInfo.config.config.rateLimitAdmin, "Rate Limit Admin")
    );

    // Token Configuration
    logger.info("\n🪙 TOKEN CONFIGURATION");
    logger.info("-".repeat(40));
    logger.info(
      formatPublicKey(poolInfo.config.config.tokenProgram, "Token Program")
    );
    logger.info(
      formatPublicKey(poolInfo.config.config.poolSigner, "Pool Signer PDA")
    );
    logger.info(
      formatPublicKey(
        poolInfo.config.config.poolTokenAccount,
        "Pool Token Account"
      )
    );

    // CCIP Integration
    logger.info("\n🌉 CCIP INTEGRATION");
    logger.info("-".repeat(40));
    logger.info(formatPublicKey(poolInfo.config.config.router, "CCIP Router"));
    logger.info(
      formatPublicKey(
        poolInfo.config.config.routerOnrampAuthority,
        "Router Onramp Authority"
      )
    );
    logger.info(
      formatPublicKey(poolInfo.config.config.rmnRemote, "RMN Remote")
    );

    // Security & Controls
    logger.info("\n🔒 SECURITY & CONTROLS");
    logger.info("-".repeat(40));
    logger.info(
      `Allowlist: ${formatBoolean(poolInfo.config.config.listEnabled)}`
    );
    if (
      poolInfo.config.config.listEnabled &&
      poolInfo.config.config.allowList.length > 0
    ) {
      logger.info(
        `Allowlist Entries (${poolInfo.config.config.allowList.length}):`
      );
      poolInfo.config.config.allowList.forEach((addr, index) => {
        logger.info(`  ${index + 1}. ${addr.toString()}`);
      });
    } else if (poolInfo.config.config.listEnabled) {
      logger.info(
        "  ⚠️  Allowlist is enabled but empty - no addresses can transfer"
      );
    }

    // Rebalancing (for reference, not used in burn-mint pools)
    logger.info("\n⚖️ REBALANCING (Lock/Release Only)");
    logger.info("-".repeat(40));
    logger.info(
      formatPublicKey(poolInfo.config.config.rebalancer, "Rebalancer")
    );
    logger.info(
      `Can Accept Liquidity: ${formatBoolean(
        poolInfo.config.config.canAcceptLiquidity
      )}`
    );

    // Address Summary
    logger.info("\n📍 ADDRESS SUMMARY");
    logger.info("-".repeat(40));

    // Derive important PDAs for the summary
    const [poolConfigPDA] = findBurnMintPoolConfigPDA(
      tokenMint,
      burnMintPoolProgramId
    );
    const [globalConfigPDA] = findGlobalConfigPDA(burnMintPoolProgramId);

    logger.info(`Token Mint:           ${tokenMint.toString()}`);
    logger.info(`Pool Program:         ${burnMintPoolProgramId.toString()}`);
    logger.info(
      `Pool Config PDA:      ${poolConfigPDA.toString()}  (Pool state account)`
    );
    logger.info(
      `Global Config PDA:    ${globalConfigPDA.toString()}  (Program global config)`
    );
    logger.info(
      `Pool Owner:           ${poolInfo.config.config.owner.toString()}`
    );
    logger.info(
      `Pool Signer PDA:      ${poolInfo.config.config.poolSigner.toString()}  (Token authority)`
    );

    logger.info("\n" + "=".repeat(80));
    logger.info("✅ Pool information retrieved successfully!");

    // Next steps suggestions
    logger.info("\n💡 NEXT STEPS");
    logger.info("-".repeat(40));
    logger.info("• Configure remote chains for cross-chain transfers");
    logger.info("• Set up rate limits for security");
    logger.info("• Configure allowlists if needed");
    logger.info("• Transfer ownership if this is a temporary deployer");
  } catch (error) {
    logger.error("Failed to get pool info:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        logger.info("\n❌ Pool not found");
        logger.info(
          "The pool may not be initialized yet or the addresses may be incorrect."
        );
      } else if (error.message.includes("Account is not owned")) {
        logger.info("\n❌ Invalid program ID");
        logger.info(
          "The account exists but is not owned by the specified program."
        );
      }
    }

    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🏊 CCIP Pool Information Viewer

Usage: yarn svm:pool:get-info [options]

Required Options:
  --token-mint <address>           Token mint address to get info for
  --burn-mint-pool-program <id>    Burn-mint token pool program ID

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:get-info \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh

  yarn svm:pool:get-info \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --log-level DEBUG

Notes:
  • This script provides comprehensive information about an existing pool
  • All addresses and configuration details are displayed
  • Suggestions for next steps are provided
  • Pool must be initialized before running this script
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
