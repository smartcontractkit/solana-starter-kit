/**
 * Chain Configuration Retrieval Script
 *
 * This script retrieves and displays the chain remote configuration for a burn-mint token pool,
 * showing the configuration details for cross-chain token transfers to a specific remote chain.
 *
 * INSTRUCTIONS:
 * 1. The token pool and chain configuration must already exist
 * 2. Provide the token mint and remote chain details
 * 3. Run the script with: yarn svm:pool:get-chain-config
 *
 * Required arguments:
 * --token-mint              : Token mint address of existing pool
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 * --remote-chain            : Remote chain to query (chain-id)
 *
 * Optional arguments:
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 *
 * NOTE: This is a READ-ONLY operation that does not require a wallet or keypair.
 *
 * Example usage:
 * yarn svm:pool:get-chain-config \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *   --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
 *   --remote-chain ethereum-sepolia
 */

import { PublicKey } from "@solana/web3.js";
import { createTokenPoolClient, TokenPoolClientOptions } from "./client";
import { ChainId, getCCIPSVMConfig } from "../../config";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { parseArgs, displayAvailableRemoteChains } from "../utils/args-parser";

const SCRIPT_ARGS = [
  {
    name: "token-mint",
    description: "Token mint address of existing pool",
    required: true,
    type: "string" as const,
  },
  {
    name: "burn-mint-pool-program",
    description: "Burn-mint token pool program ID",
    required: true,
    type: "string" as const,
  },
  {
    name: "remote-chain",
    description: "Remote chain to query (chain-id)",
    required: true,
    type: "remote-chain" as const,
  },
  {
    name: "log-level",
    description: "Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)",
    required: false,
    type: "string" as const,
  },
];

async function main() {
  // Check for help
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  // Parse arguments
  const options = parseArgs(SCRIPT_ARGS);

  // Create logger
  const logger = createLogger("get-chain-config", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Chain Configuration Reader (Read-Only)");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

  try {
    // Parse addresses
    const tokenMint = new PublicKey(options["token-mint"]);
    const burnMintPoolProgramId = new PublicKey(
      options["burn-mint-pool-program"]
    );
    const remoteChainSelector = options["remote-chain"] as bigint;

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`Remote Chain Selector: ${remoteChainSelector.toString()}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Log level: ${options["log-level"]}`);

    // Create token pool client (read-only, no wallet needed)
    const clientOptions: TokenPoolClientOptions = {
      connection: config.connection,
      logLevel: (options["log-level"] as LogLevel) || LogLevel.INFO,
      skipPreflight: false, // Not relevant for read operations
    };

    const tokenPoolClient = await createTokenPoolClient(
      burnMintPoolProgramId,
      tokenMint,
      clientOptions
    );

    // Get the chain config
    logger.info("Retrieving chain configuration...");
    const chainConfig = await tokenPoolClient.getChainConfig({
      mint: tokenMint,
      remoteChainSelector,
    });

    // Display the configuration
    logger.info(`Chain configuration retrieved successfully! 🎉`);
    console.log("");
    console.log("📋 Chain Configuration Details:");
    console.log("================================");
    console.log(`Account Address: ${chainConfig.address}`);
    console.log("");

    console.log("🔗 Remote Chain Information:");
    console.log(`  Decimals: ${chainConfig.base.decimals}`);
    console.log(`  Token Address: 0x${chainConfig.base.tokenAddress.address}`);
    console.log("");

    console.log("🏊 Pool Addresses:");
    chainConfig.base.poolAddresses.forEach((pool: any, index: number) => {
      console.log(`  ${index + 1}. 0x${pool.address}`);
    });
    console.log("");

    console.log("⬇️  Inbound Rate Limit:");
    console.log(`  Enabled: ${chainConfig.base.inboundRateLimit.isEnabled}`);
    console.log(
      `  Capacity: ${chainConfig.base.inboundRateLimit.capacity.toString()}`
    );
    console.log(
      `  Rate: ${chainConfig.base.inboundRateLimit.rate.toString()} tokens/second`
    );
    console.log(
      `  Current Bucket Value: ${chainConfig.base.inboundRateLimit.currentBucketValue.toString()}`
    );
    console.log(
      `  Last Updated: ${new Date(
        Number(chainConfig.base.inboundRateLimit.lastTxTimestamp) * 1000
      ).toISOString()}`
    );
    console.log("");

    console.log("⬆️  Outbound Rate Limit:");
    console.log(`  Enabled: ${chainConfig.base.outboundRateLimit.isEnabled}`);
    console.log(
      `  Capacity: ${chainConfig.base.outboundRateLimit.capacity.toString()}`
    );
    console.log(
      `  Rate: ${chainConfig.base.outboundRateLimit.rate.toString()} tokens/second`
    );
    console.log(
      `  Current Bucket Value: ${chainConfig.base.outboundRateLimit.currentBucketValue.toString()}`
    );
    console.log(
      `  Last Updated: ${new Date(
        Number(chainConfig.base.outboundRateLimit.lastTxTimestamp) * 1000
      ).toISOString()}`
    );
    console.log("");

    logger.info("💡 Use edit-chain-remote-config to update this configuration");
    logger.info("💡 Use set-rate-limit to update rate limits separately");
  } catch (error) {
    logger.error("Failed to retrieve chain configuration:", error);
    console.log("");
    console.log("❌ Common Issues:");
    console.log("  • Chain configuration does not exist for this remote chain");
    console.log("  • Token pool does not exist for this mint");
    console.log("  • Invalid remote chain selector");
    console.log("");
    console.log("💡 Solutions:");
    console.log(
      "  • Use init-chain-remote-config to create the configuration first"
    );
    console.log("  • Use get-pool-info to verify the pool exists");
    console.log("  • Check available chains with --help");
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔍 CCIP Chain Configuration Reader

Usage: yarn svm:pool:get-chain-config [options]

Required Options:
  --token-mint <address>           Token mint address of existing pool
  --burn-mint-pool-program <id>    Burn-mint token pool program ID
  --remote-chain <chain-id>        Remote chain (chain-id)

Optional Options:
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:get-chain-config \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --remote-chain ethereum-sepolia

  yarn svm:pool:get-chain-config \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --remote-chain base-sepolia \\
    --log-level DEBUG

Remote Chain Options:
`);

  displayAvailableRemoteChains();

  console.log(`
Notes:
  • This is a READ-ONLY operation that doesn't require a wallet/keypair
  • No transaction fees or signatures needed
  • The token pool and chain configuration must already exist
  • Shows detailed configuration including rate limits and current usage
  • Use this before editing configurations to see current values
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
