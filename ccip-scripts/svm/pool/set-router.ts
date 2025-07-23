/**
 * Token Pool Set Router Script
 *
 * This script sets the configured CCIP router for an existing burn-mint token pool.
 * Only the pool owner can execute this operation.
 *
 * The router address is automatically loaded from the configuration, ensuring
 * consistency with other CCIP scripts and reducing configuration errors.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. Ensure you are the owner of the token pool
 * 3. Provide the token mint and burn-mint pool program ID
 * 4. Run the script with: yarn svm:pool:set-router
 *
 * Required arguments:
 * --token-mint              : Token mint address of the pool
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight          : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:set-router --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to setting router
 */
function parseSetRouterArgs() {
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

async function main() {
  // Parse arguments
  const options = parseSetRouterArgs();

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
  const logger = createLogger("pool-set-router", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Pool Set Router");

  // Load configuration
  // Resolve network configuration based on options
  const config = resolveNetworkConfig(options);

  // Get keypair path and load wallet
  const keypairPath = getKeypairPath(options);
  logger.info(`Loading keypair from ${keypairPath}...`);

  try {
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

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
    const tokenMint = new PublicKey(options.tokenMint);
    const burnMintPoolProgramId = new PublicKey(options.burnMintPoolProgram);
    const newRouter = config.routerProgramId; // Get router from config

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`CCIP Router (from config): ${newRouter.toString()}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);
    logger.debug(`  Log level: ${options.logLevel}`);

    // Create token pool client
    // Create token pool manager using SDK
    const tokenPoolManager = TokenPoolManager.create(
      config.connection,
      walletKeypair,
      {
        burnMint: burnMintPoolProgramId,
         // Using same program for both
      },
      {
        ccipRouterProgramId: config.routerProgramId.toString(),
        feeQuoterProgramId: config.feeQuoterProgramId.toString(),
        rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
        linkTokenMint: config.linkTokenMint.toString(),
        receiverProgramId: config.receiverProgramId.toString(),
      },
      { logLevel: options.logLevel || LogLevel.INFO }
    );

    const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

    // Check if pool exists
    logger.info("Checking if pool exists...");
    logger.debug(`Checking pool existence for mint: ${tokenMint.toString()}`);
    const poolExists = await tokenPoolClient.hasPool(tokenMint);
    logger.debug(`Pool exists: ${poolExists}`);

    if (!poolExists) {
      logger.error("Pool does not exist for this token mint");
      logger.info("Initialize the pool first using 'yarn svm:pool:initialize'");
      logger.debug(
        `To initialize: yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
      process.exit(1);
    }

    // Get current pool info to show current router
    logger.info("Fetching current pool configuration...");
    try {
      const poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
      const currentRouter = poolInfo.config.config.router.toString();
      logger.info(`Current router: ${currentRouter}`);
      logger.info(`Pool owner: ${poolInfo.config.config.owner.toString()}`);

      if (currentRouter === newRouter.toString()) {
        logger.info("✅ Router is already set to the configured CCIP router");
        logger.info("No changes needed");
        return;
      }

      logger.debug("Current pool details:", {
        poolType: poolInfo.poolType,
        owner: poolInfo.config.config.owner.toString(),
        version: poolInfo.config.version,
        decimals: poolInfo.config.config.decimals,
        currentRouter: currentRouter,
      });
    } catch (error) {
      logger.warn(`Could not fetch current pool info: ${error}`);
      logger.debug("Pool info fetch error:", error);
    }

    // Set the new router
    logger.info("Setting router to configured CCIP router...");
    const signature = await tokenPoolClient.setRouter(tokenMint, {
      newRouter: newRouter,
      skipPreflight: options.skipPreflight,
    });

    logger.info(`Router updated successfully!`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);

    // Verify the router update
    logger.info("Verifying router update...");
    logger.debug("Attempting to fetch pool info to verify router update...");
    try {
      const updatedPoolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
      const updatedRouter = updatedPoolInfo.config.config.router.toString();

      if (updatedRouter === newRouter.toString()) {
        logger.info("✅ Router update verified successfully!");
        logger.info(`Updated router: ${updatedRouter}`);
        logger.debug("Router update verification details:", {
          previousRouter: "N/A", // We could store this from before if needed
          newRouter: updatedRouter,
          owner: updatedPoolInfo.config.config.owner.toString(),
        });
      } else {
        logger.warn(
          "Router update completed but verification shows different router"
        );
        logger.warn(`Expected: ${newRouter.toString()}`);
        logger.warn(`Actual: ${updatedRouter}`);
      }

      logger.trace("Complete verification info:", updatedPoolInfo);
      logger.info(
        `💡 View details: yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
    } catch (error) {
      logger.warn(
        `Router transaction succeeded but verification failed: ${error}`
      );
      logger.debug("Verification error details:", error);
      logger.info(
        "This may be due to network delays - the router should be updated shortly"
      );
    }
  } catch (error) {
    logger.error("Router update failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔄 CCIP Token Pool Router Setter

Usage: yarn svm:pool:set-router [options]

Required Options:
  --token-mint <address>           Token mint address of the pool
  --burn-mint-pool-program <id>    Burn-mint token pool program ID

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:set-router \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh

  yarn svm:pool:set-router \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --log-level DEBUG

Notes:
  • Only the pool owner can set a router
  • The pool must already exist before setting a router
  • Router address is automatically loaded from CCIP configuration
  • Router change requires SOL for transaction fees
  • Use 'yarn svm:pool:get-info' to view current pool configuration
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
