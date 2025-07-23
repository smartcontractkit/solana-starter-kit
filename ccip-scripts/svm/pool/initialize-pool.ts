/**
 * Token Pool Initialization Script
 *
 * This script initializes a burn-mint token pool for CCIP cross-chain token transfers.
 * It creates a State PDA (Program Derived Address) that stores the pool configuration.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. Provide the token mint and burn-mint pool program ID
 * 3. Run the script with: yarn svm:pool:initialize
 *
 * Required arguments:
 * --token-mint              : Token mint address to create pool for
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight          : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:initialize --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createTokenPoolManager } from "../utils/client-factory";
import { TokenPoolType } from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { findBurnMintPoolConfigPDA } from "../../../ccip-lib/svm/utils/pdas/tokenpool";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to pool initialization
 */
function parsePoolArgs() {
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
  const options = parsePoolArgs();

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
  const logger = createLogger("pool-initialize", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Pool Initialization");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

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

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`Router Program: ${config.routerProgramId.toString()}`);
    logger.info(`RMN Remote Program: ${config.rmnRemoteProgramId.toString()}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);
    logger.debug(`  Log level: ${options.logLevel}`);

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

    // Check if pool already exists by checking the State PDA directly
    // This avoids SDK error logging when the account doesn't exist yet
    logger.info("Checking if pool already exists...");
    const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
      tokenMint,
      burnMintPoolProgramId
    );
    logger.debug(`State PDA: ${statePDA.toString()} (bump: ${stateBump})`);

    const stateAccountInfo = await config.connection.getAccountInfo(statePDA);
    const poolExists = stateAccountInfo !== null;
    logger.debug(`Pool exists: ${poolExists}`);

    if (poolExists) {
      logger.warn("Pool already exists for this token mint");
      logger.info(`Existing pool State PDA: ${statePDA.toString()}`);
      logger.info("Use 'yarn svm:pool:get-info' to view pool details");
      logger.debug(
        `To view details: yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
      return;
    }

    // Initialize the pool
    logger.info("Initializing token pool...");
    logger.debug(`Creating State PDA at: ${statePDA.toString()}`);
    const signature = await tokenPoolClient.initializePool(tokenMint, {
      txOptions: {
        skipPreflight: options.skipPreflight,
      },
    });

    logger.info(`Pool initialized successfully! 🎉`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);
    logger.info(`📍 Pool State PDA: ${statePDA.toString()}`);
    logger.debug(`State PDA bump: ${stateBump}`);

    // Verify initialization
    logger.info("Verifying pool initialization...");
    logger.debug("Attempting to fetch pool info to verify initialization...");
    try {
      const poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
      logger.info("✅ Pool initialization verified successfully!");
      logger.info(`✅ State PDA confirmed active: ${statePDA.toString()}`);
      logger.debug("Pool verification details:", {
        statePDA: statePDA.toString(),
        stateBump: stateBump,
        poolType: poolInfo.poolType,
        owner: poolInfo.config.config.owner.toString(),
        version: poolInfo.config.version,
        decimals: poolInfo.config.config.decimals,
        router: poolInfo.config.config.router.toString(),
      });
      logger.trace("Complete verification info:", poolInfo);

      logger.info("");
      logger.info("🎯 Pool Creation Summary:");
      logger.info(`   Token Mint: ${tokenMint.toString()}`);
      logger.info(`   State PDA: ${statePDA.toString()}`);
      logger.info(`   Owner: ${poolInfo.config.config.owner.toString()}`);
      logger.info(`   Program: ${burnMintPoolProgramId.toString()}`);
      logger.info("");
      logger.info(
        `💡 View details: yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
    } catch (error) {
      logger.warn(
        `Pool transaction succeeded but verification failed: ${error}`
      );
      logger.debug("Verification error details:", error);
      logger.info("");
      logger.info("🎯 Pool Creation Summary (Unverified):");
      logger.info(`   Token Mint: ${tokenMint.toString()}`);
      logger.info(`   State PDA: ${statePDA.toString()}`);
      logger.info(`   Program: ${burnMintPoolProgramId.toString()}`);
      logger.info("");
      logger.info(
        "This may be due to network delays - the pool should exist shortly"
      );
    }
  } catch (error) {
    logger.error("Pool initialization failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🏊 CCIP Token Pool Initializer

Usage: yarn svm:pool:initialize [options]

Required Options:
  --token-mint <address>           Token mint address to create pool for
  --burn-mint-pool-program <id>    Burn-mint token pool program ID

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:initialize \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh

  yarn svm:pool:initialize \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --log-level DEBUG

Notes:
  • The wallet will become the pool administrator
  • Router and RMN Remote program IDs are retrieved from configuration
  • Pool initialization requires SOL for transaction fees
  • Creates a State PDA account that represents the pool configuration
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
