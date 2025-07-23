/**
 * Pool Token Account Creation Script
 *
 * This script creates the Associated Token Account (ATA) for the pool signer PDA.
 * This account is required for the pool to hold tokens during cross-chain operations.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. Pool must already be initialized before running this script
 * 3. Run the script with: yarn svm:pool:create-token-account
 *
 * Required arguments:
 * --token-mint              : Token mint address for the pool
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight          : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:create-token-account --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz
 */

import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createTokenPoolClient, TokenPoolClientOptions } from "./client";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { determineTokenProgramId } from "../utils/token-utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { findPoolSignerPDA } from "../../../ccip-lib/svm/utils/pdas/tokenpool";

// ========== CONFIGURATION ==========
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to pool token account creation
 * 
 * Extends the base common arguments with pool-specific parameters required
 * for creating Associated Token Accounts (ATAs) for token pool operations.
 * 
 * @returns Object containing parsed arguments including tokenMint and burnMintPoolProgram
 * 
 * Required arguments:
 * - --token-mint: The mint address of the token for which to create pool ATA
 * - --burn-mint-pool-program: Program ID of the burn-mint token pool program
 */
function parsePoolTokenAccountArgs() {
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
 * Main function for pool token account creation
 * 
 * Orchestrates the complete process of creating an Associated Token Account (ATA)
 * for a token pool's signer PDA. This account is essential for the pool to hold
 * tokens during cross-chain operations.
 * 
 * Process:
 * 1. Validates arguments and loads wallet configuration
 * 2. Verifies the token pool exists and gets pool information
 * 3. Derives the pool signer PDA using the library function
 * 4. Creates the ATA for the pool signer if it doesn't exist
 * 5. Verifies successful creation
 * 
 * @throws Error if pool doesn't exist, insufficient SOL, or ATA creation fails
 */
async function main() {
  // Parse arguments
  const options = parsePoolTokenAccountArgs();

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
  const logger = createLogger("pool-token-account", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Pool Token Account Creation");

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

    // Create token pool client to verify pool exists
    const clientOptions: TokenPoolClientOptions = {
      connection: config.connection,
      logLevel: options.logLevel || LogLevel.INFO,
      skipPreflight: options.skipPreflight,
    };

    const tokenPoolClient = await createTokenPoolClient(
      burnMintPoolProgramId,
      tokenMint,
      clientOptions
    );

    // Verify pool exists
    logger.info("Verifying pool exists...");
    const poolExists = await tokenPoolClient.hasPool({ mint: tokenMint });

    if (!poolExists) {
      logger.error("Pool does not exist for this token mint");
      logger.info("Initialize the pool first:");
      logger.info(
        `yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
      process.exit(1);
    }

    // Get pool info to verify current state
    logger.info("Getting pool information...");
    const poolInfo = await tokenPoolClient.getPoolInfo();
    const currentPoolTokenAccount = poolInfo.config.config.poolTokenAccount;

    logger.info(
      `Current pool token account: ${currentPoolTokenAccount.toString()}`
    );

    // Determine token program ID
    const tokenProgramId = await determineTokenProgramId(
      tokenMint,
      config.connection,
      logger
    );

    // Derive pool signer PDA using the library function
    const [poolSigner, poolSignerBump] = findPoolSignerPDA(
      tokenMint,
      burnMintPoolProgramId
    );
    logger.info(`Pool signer PDA: ${poolSigner.toString()}`);
    logger.debug(`Pool signer bump: ${poolSignerBump}`);

    // Check if pool signer matches what's in the pool config
    const configPoolSigner = poolInfo.config.config.poolSigner;
    if (!poolSigner.equals(configPoolSigner)) {
      logger.warn(`Pool signer mismatch!`);
      logger.warn(`  Calculated: ${poolSigner.toString()}`);
      logger.warn(`  In config:  ${configPoolSigner.toString()}`);
      logger.info("Using pool signer from configuration...");
    }

    // Use the pool signer from the configuration (in case of any discrepancy)
    const actualPoolSigner = configPoolSigner;

    // Calculate the expected ATA
    const expectedATA = await getAssociatedTokenAddress(
      tokenMint,
      actualPoolSigner,
      true, // allowOwnerOffCurve
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    logger.info(`Expected pool token account (ATA): ${expectedATA.toString()}`);

    // Check if the expected ATA matches the current pool token account
    if (!expectedATA.equals(currentPoolTokenAccount)) {
      logger.warn(`Pool token account mismatch!`);
      logger.warn(`  Expected: ${expectedATA.toString()}`);
      logger.warn(`  Current:  ${currentPoolTokenAccount.toString()}`);
      logger.info("This script will create the expected ATA...");
    }

    // Check if the ATA already exists
    logger.info("Checking if pool token account already exists...");
    const existingAccount = await config.connection.getAccountInfo(expectedATA);

    if (existingAccount) {
      logger.info("✅ Pool token account already exists!");
      logger.info(`Account address: ${expectedATA.toString()}`);
      logger.info(`Owner: ${actualPoolSigner.toString()}`);
      logger.info("No action needed.");
      return;
    }

    // Create the ATA
    logger.info("Creating pool token account (ATA)...");
    logger.debug(`Creating ATA for:`);
    logger.debug(`  Mint: ${tokenMint.toString()}`);
    logger.debug(`  Owner (Pool Signer): ${actualPoolSigner.toString()}`);
    logger.debug(`  Payer: ${walletKeypair.publicKey.toString()}`);
    logger.debug(`  Token Program: ${tokenProgramId.toString()}`);

    const createATAInstruction = createAssociatedTokenAccountInstruction(
      walletKeypair.publicKey, // payer
      expectedATA, // ata address
      actualPoolSigner, // owner of the ATA (pool signer)
      tokenMint, // token mint
      tokenProgramId, // token program
      ASSOCIATED_TOKEN_PROGRAM_ID // ATA program
    );

    // Create and send transaction
    const transaction = new Transaction().add(createATAInstruction);

    logger.debug("Sending transaction...");
    const signature = await sendAndConfirmTransaction(
      config.connection,
      transaction,
      [walletKeypair],
      {
        skipPreflight: options.skipPreflight,
        commitment: config.connection.commitment,
      }
    );

    logger.info("✅ Pool token account created successfully!");
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);
    logger.info(`Pool token account address: ${expectedATA.toString()}`);

    // Verify creation
    logger.info("Verifying account creation...");
    const verificationAccount = await config.connection.getAccountInfo(
      expectedATA
    );

    if (verificationAccount) {
      logger.info("✅ Account creation verified!");
      logger.debug(`Account owner: ${verificationAccount.owner.toString()}`);
      logger.debug(`Account lamports: ${verificationAccount.lamports}`);
    } else {
      logger.warn(
        "⚠️ Account verification failed - this may be due to network delays"
      );
    }

    logger.info("\n🎉 Pool Token Account Setup Complete!");
    logger.info(`   ✅ ATA Address: ${expectedATA.toString()}`);
    logger.info(
      `   ✅ Owner: ${actualPoolSigner.toString()} (Pool Signer PDA)`
    );
    logger.info(`   ✅ Ready for cross-chain token operations`);
  } catch (error) {
    logger.error("Pool token account creation failed:", error);

    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        logger.info("Insufficient SOL for transaction fees");
        logger.info("Request more SOL from the devnet faucet");
      } else if (error.message.includes("already in use")) {
        logger.info("Account may already exist - check with get-pool-info");
      }
    }

    process.exit(1);
  }
}

/**
 * Print comprehensive usage information for the pool token account creation script
 * 
 * Displays detailed help including:
 * - Script purpose and prerequisites
 * - Required and optional command line arguments
 * - Usage examples with real addresses
 * - What the script accomplishes
 * - Next steps after successful execution
 */
function printUsage() {
  console.log(`
🏊 CCIP Pool Token Account Creator

This script creates the Associated Token Account (ATA) for the pool signer PDA.
This account is required for the pool to hold tokens during cross-chain operations.

Usage: yarn svm:pool:create-token-account [options]

Required Options:
  --token-mint <address>           Token mint address for the pool
  --burn-mint-pool-program <id>    Burn-mint token pool program ID

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:create-token-account \\
    --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \\
    --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz

  yarn svm:pool:create-token-account \\
    --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \\
    --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz \\
    --log-level DEBUG

Prerequisites:
  • Pool must be initialized first (yarn svm:pool:initialize)
  • Wallet must have sufficient SOL for transaction fees
  • Token mint must exist and be valid

What this script does:
  • Verifies the pool exists and gets configuration
  • Calculates the pool signer PDA address
  • Creates the Associated Token Account for the pool signer
  • Verifies the account was created successfully

After running this script:
  • The pool will be able to hold tokens during cross-chain operations
  • Cross-chain transfers should work without "AccountNotInitialized" errors
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
