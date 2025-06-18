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
import { createTokenPoolClient, TokenPoolClientOptions } from "./client";
import { ChainId, getCCIPSVMConfig } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

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
    level: options.logLevel || LogLevel.INFO,
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

    // Create token pool client
    const clientOptions: TokenPoolClientOptions = {
      connection: config.connection,
      logLevel: options.logLevel || LogLevel.INFO, // Use INFO as default
      skipPreflight: options.skipPreflight,
    };

    const tokenPoolClient = await createTokenPoolClient(
      burnMintPoolProgramId,
      tokenMint,
      clientOptions
    );

    // Check if pool exists
    logger.info("Checking if pool exists...");
    logger.debug(`Checking pool existence for mint: ${tokenMint.toString()}`);
    const poolExists = await tokenPoolClient.hasPool({ mint: tokenMint });
    logger.debug(`Pool exists: ${poolExists}`);

    if (!poolExists) {
      console.log("\n❌ Pool does not exist for this token mint");
      console.log("\n💡 Run the initialization script first:");
      console.log(
        `yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
      logger.debug("Pool not found - terminating script");
      return;
    }

    // Get pool information
    logger.info("Fetching pool information...");
    logger.debug("Retrieving complete pool configuration...");
    const poolInfo = await tokenPoolClient.getPoolInfo();
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
    console.log("\n" + "=".repeat(80));
    console.log("🏊 BURN-MINT TOKEN POOL INFORMATION");
    console.log("=".repeat(80));

    // Global Configuration
    console.log("\n🌍 GLOBAL CONFIGURATION");
    console.log("-".repeat(40));
    if (globalConfigInfo && globalConfigInfo.config) {
      console.log(`Program Version: ${globalConfigInfo.config.version}`);
      console.log(
        `Self-Served Pools: ${formatBoolean(
          globalConfigInfo.config.self_served_allowed
        )}`
      );
    } else {
      console.log("❌ Global config not found or not initialized");
      console.log("💡 Run: yarn svm:pool:init-global-config first");
    }

    // Basic Pool Info
    console.log("\n📋 BASIC INFORMATION");
    console.log("-".repeat(40));
    console.log(`Pool Type: ${poolInfo.poolType}`);
    console.log(`Version: ${poolInfo.config.version}`);
    console.log(formatPublicKey(poolInfo.config.config.mint, "Token Mint"));
    console.log(`Decimals: ${poolInfo.config.config.decimals}`);

    // Ownership & Permissions
    console.log("\n👥 OWNERSHIP & PERMISSIONS");
    console.log("-".repeat(40));
    console.log(formatPublicKey(poolInfo.config.config.owner, "Current Owner"));
    console.log(
      formatPublicKey(poolInfo.config.config.proposed_owner, "Proposed Owner")
    );
    console.log(
      formatPublicKey(
        poolInfo.config.config.rate_limit_admin,
        "Rate Limit Admin"
      )
    );

    // Token Configuration
    console.log("\n🪙 TOKEN CONFIGURATION");
    console.log("-".repeat(40));
    console.log(
      formatPublicKey(poolInfo.config.config.token_program, "Token Program")
    );
    console.log(
      formatPublicKey(poolInfo.config.config.pool_signer, "Pool Signer PDA")
    );
    console.log(
      formatPublicKey(
        poolInfo.config.config.pool_token_account,
        "Pool Token Account"
      )
    );

    // CCIP Integration
    console.log("\n🌉 CCIP INTEGRATION");
    console.log("-".repeat(40));
    console.log(formatPublicKey(poolInfo.config.config.router, "CCIP Router"));
    console.log(
      formatPublicKey(
        poolInfo.config.config.router_onramp_authority,
        "Router Onramp Authority"
      )
    );
    console.log(
      formatPublicKey(poolInfo.config.config.rmn_remote, "RMN Remote")
    );

    // Security & Controls
    console.log("\n🔒 SECURITY & CONTROLS");
    console.log("-".repeat(40));
    console.log(
      `Allowlist: ${formatBoolean(poolInfo.config.config.list_enabled)}`
    );
    if (
      poolInfo.config.config.list_enabled &&
      poolInfo.config.config.allow_list.length > 0
    ) {
      console.log(
        `Allowlist Entries (${poolInfo.config.config.allow_list.length}):`
      );
      poolInfo.config.config.allow_list.forEach((addr, index) => {
        console.log(`  ${index + 1}. ${addr.toString()}`);
      });
    } else if (poolInfo.config.config.list_enabled) {
      console.log(
        "  ⚠️  Allowlist is enabled but empty - no addresses can transfer"
      );
    }

    // Rebalancing (for reference, not used in burn-mint pools)
    console.log("\n⚖️ REBALANCING (Lock/Release Only)");
    console.log("-".repeat(40));
    console.log(
      formatPublicKey(poolInfo.config.config.rebalancer, "Rebalancer")
    );
    console.log(
      `Can Accept Liquidity: ${formatBoolean(
        poolInfo.config.config.can_accept_liquidity
      )}`
    );

    // Address Summary
    console.log("\n📍 ADDRESS SUMMARY");
    console.log("-".repeat(40));
    console.log(`Token Mint:           ${tokenMint.toString()}`);
    console.log(`Pool Program:         ${burnMintPoolProgramId.toString()}`);
    console.log(
      `Pool Owner:           ${poolInfo.config.config.owner.toString()}`
    );
    console.log(
      `Pool Signer PDA:      ${poolInfo.config.config.pool_signer.toString()}`
    );

    console.log("\n" + "=".repeat(80));
    console.log("✅ Pool information retrieved successfully!");

    // Next steps suggestions
    console.log("\n💡 NEXT STEPS");
    console.log("-".repeat(40));
    console.log("• Configure remote chains for cross-chain transfers");
    console.log("• Set up rate limits for security");
    console.log("• Configure allowlists if needed");
    console.log("• Transfer ownership if this is a temporary deployer");
  } catch (error) {
    logger.error("Failed to get pool info:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        console.log("\n❌ Pool not found");
        console.log(
          "The pool may not be initialized yet or the addresses may be incorrect."
        );
      } else if (error.message.includes("Account is not owned")) {
        console.log("\n❌ Invalid program ID");
        console.log(
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
