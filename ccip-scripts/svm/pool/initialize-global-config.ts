/**
 * Global Config Initialization Script
 *
 * This script initializes the global configuration for a burn-mint token pool program.
 * This MUST be run once per program deployment before any individual pools can be created.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have the program upgrade authority keypair
 * 2. Ensure you have SOL for transaction fees (at least 0.01 SOL)
 * 3. Provide the burn-mint pool program ID
 * 4. Run the script with: yarn svm:pool:init-global-config
 *
 * Required arguments:
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file (must be program upgrade authority)
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight          : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:init-global-config --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh
 *
 * IMPORTANT:
 * - This script must be run by the program upgrade authority
 * - This only needs to be run ONCE per program deployment
 * - After this succeeds, individual pools can be initialized with initialize-pool.ts
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createTokenPoolManager } from "../utils/client-factory";
import { TokenPoolType } from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to global config initialization
 */
function parseGlobalConfigArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let burnMintPoolProgram: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
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
    burnMintPoolProgram,
  };
}

async function main() {
  // Parse arguments
  const options = parseGlobalConfigArgs();

  // Check for help
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  // Validate required arguments
  if (!options.burnMintPoolProgram) {
    console.error("Error: --burn-mint-pool-program is required");
    printUsage();
    process.exit(1);
  }

  // Create logger
  const logger = createLogger("global-config-initialize", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Pool Global Config Initialization");
  logger.warn(
    "⚠️  This must be run by the program upgrade authority ONCE per deployment"
  );

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

  // Get keypair path and load wallet
  const keypairPath = getKeypairPath(options);
  logger.info(`Loading keypair from ${keypairPath}...`);

  try {
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);
    logger.warn(
      "🔑 Ensure this wallet is the program upgrade authority for the token pool program"
    );

    // Check balance
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    logger.info(`Wallet balance: ${solBalance} SOL`);

    if (solBalance < MIN_SOL_REQUIRED) {
      logger.error(
        `Insufficient balance. Need at least ${MIN_SOL_REQUIRED} SOL for transaction fees.`
      );
      logger.info(
        "Request airdrop from Solana devnet faucet before proceeding."
      );
      logger.info(
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
      process.exit(1);
    }

    // Parse addresses
    const burnMintPoolProgramId = new PublicKey(options.burnMintPoolProgram);

    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`Router Program: ${config.routerProgramId.toString()}`);
    logger.info(`RMN Remote Program: ${config.rmnRemoteProgramId.toString()}`);

    logger.debug(`Global config initialization details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Authority: ${walletKeypair.publicKey.toString()}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);

    // Create token pool manager using SDK
    const tokenPoolManager = createTokenPoolManager(
      burnMintPoolProgramId,
      {
        keypairPath: keypairPath,
        logLevel: options.logLevel !== undefined ? options.logLevel : LogLevel.INFO,
        skipPreflight: options.skipPreflight,
      }
    );

    const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

    // Initialize the global config
    logger.info("Initializing global configuration...");
    logger.info("📋 This creates the program-wide configuration PDA");
    logger.debug("Calling SDK initializeGlobalConfig method...");
    logger.debug(`Transaction options: skipPreflight=${options.skipPreflight}`);

    const signature = await tokenPoolClient.initializeGlobalConfig({
      txOptions: {
        skipPreflight: options.skipPreflight,
      },
    });

    logger.debug(`Transaction completed with signature: ${signature}`);

    logger.info(`Global config initialized successfully! 🎉`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);

    logger.info("");
    logger.info("✅ Global configuration is now ready!");
    logger.info(
      "🏊 You can now initialize individual token pools using initialize-pool.ts"
    );
    logger.info("");
    logger.info("Next steps:");
    logger.info("1. Deploy your token mint (if not already done)");
    logger.info(
      "2. Run: yarn svm:pool:update-self-served-allowed --self-served-allowed true --burn-mint-pool-program <PROGRAM>"
    );
  } catch (error) {
    logger.error("Global config initialization failed:", error);

    // Provide helpful error context
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        logger.error("");
        logger.error("🚨 Authorization Error:");
        logger.error(
          "   The wallet is not the program upgrade authority for this program."
        );
        logger.error(
          "   Only the program upgrade authority can initialize global config."
        );
      } else if (error.message.includes("already in use")) {
        logger.warn("");
        logger.warn("⚠️  Global config may already be initialized.");
        logger.warn("   This script only needs to be run once per deployment.");
      }
    }

    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🌍 CCIP Global Config Initializer

Usage: yarn svm:pool:init-global-config [options]

Required Options:
  --burn-mint-pool-program <id>    Burn-mint token pool program ID

Optional Options:
  --keypair <path>                 Path to wallet keypair file (must be upgrade authority)
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:init-global-config \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh

  yarn svm:pool:init-global-config \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --log-level DEBUG

IMPORTANT NOTES:
  • This script MUST be run by the program upgrade authority
  • This only needs to be run ONCE per program deployment
  • After this succeeds, individual pools can be created with initialize-pool.ts
  • Global config initialization is a prerequisite for all pool operations
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
