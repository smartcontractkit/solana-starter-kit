/**
 * CCIP Token Pool Address Lookup Table (ALT) Creation Script
 *
 * This script creates an Address Lookup Table for a token pool with all necessary addresses
 * required for CCIP token operations. The ALT is essential for efficient cross-chain
 * transactions as it reduces transaction size by allowing address references instead of
 * full public keys.
 *
 * The ALT includes all required addresses:
 * - The lookup table itself
 * - Token admin registry PDA
 * - Pool program ID
 * - Pool configuration PDA
 * - Pool token account (ATA)
 * - Pool signer PDA
 * - Token program ID (auto-detected)
 * - Token mint
 * - Fee billing token config PDA
 * - CCIP router pool signer PDA
 *
 * PREREQUISITES:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. The token mint must already exist
 * 3. Know the pool program ID you want to use
 * 4. Run the script with: yarn svm:admin:create-alt
 *
 * Required arguments:
 * --token-mint       : Token mint address
 * --pool-program     : Pool program ID (burn-mint pool program)
 *
 * Optional arguments:
 * --keypair          : Path to your keypair file
 * --log-level        : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight   : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:admin:create-alt \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *   --pool-program BurnMintTokenPoolProgram111111111111111111
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { createTokenRegistryClient as sdkCreateTokenRegistryClient } from "../utils/client-factory";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to ALT creation
 */
function parseCreateAltArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let tokenMint: string | undefined;
  let poolProgram: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--token-mint":
        if (i + 1 < args.length) {
          tokenMint = args[i + 1];
          i++;
        }
        break;
      case "--pool-program":
        if (i + 1 < args.length) {
          poolProgram = args[i + 1];
          i++;
        }
        break;
    }
  }

  return {
    ...commonArgs,
    tokenMint,
    poolProgram,
  };
}

async function main() {
  // Parse arguments
  const options = parseCreateAltArgs();

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

  if (!options.poolProgram) {
    console.error("Error: --pool-program is required");
    printUsage();
    process.exit(1);
  }

  // Create logger
  const logger = createLogger("admin-create-alt", {
    level: options.logLevel || LogLevel.INFO,
  });

  logger.info("CCIP Token Pool Address Lookup Table Creation");

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
    const poolProgramId = new PublicKey(options.poolProgram);
    const feeQuoterProgramId = config.feeQuoterProgramId;
    const routerProgramId = config.routerProgramId;

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Pool Program: ${poolProgramId.toString()}`);
    logger.info(`Token Program: Auto-detected from on-chain mint data`);
    logger.info(`Fee Quoter Program: ${feeQuoterProgramId.toString()}`);
    logger.info(`Router Program: ${routerProgramId.toString()}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);
    logger.debug(`  Log level: ${options.logLevel}`);

    // Create SDK token registry client to get full result
    const sdkClient = sdkCreateTokenRegistryClient(routerProgramId.toString(), {
      connection: config.connection,
    });

    // Create the ALT
    logger.info("Creating Address Lookup Table...");
    const result = await sdkClient.createTokenPoolLookupTable({
      tokenMint,
      poolProgramId,
      feeQuoterProgramId,
    });

    logger.info(`Address Lookup Table created successfully!`);
    logger.info(`ALT Address: ${result.lookupTableAddress.toString()}`);
    logger.info(`Transaction signature: ${result.signature}`);
    logger.info(
      `Solana Explorer: ${getExplorerUrl(config.id, result.signature)}`
    );

    // Log ALT contents for verification
    logger.info(`ALT contains ${result.addresses.length} addresses:`);
    result.addresses.forEach((addr, index) => {
      const descriptions = [
        "Lookup table itself",
        "Token admin registry",
        "Pool program",
        "Pool configuration",
        "Pool token account",
        "Pool signer",
        "Token program",
        "Token mint",
        "Fee token config",
        "CCIP router pool signer",
      ];
      logger.info(
        `  [${index}]: ${addr.toString()} (${
          descriptions[index] || "Additional account"
        })`
      );
    });

    logger.info("");
    logger.info("🎉 ALT Creation Complete!");
    logger.info(
      `   ✅ Address Lookup Table: ${result.lookupTableAddress.toString()}`
    );
    logger.info(
      `   ✅ Contains all ${result.addresses.length} required addresses for token pool operations`
    );
    logger.info(`   ✅ Ready to be registered with setPool`);

    logger.info("");
    logger.info("📋 Next Steps:");
    logger.info(
      `   1. Ensure you are the administrator for token ${tokenMint.toString()}`
    );
    logger.info(`   2. Register this ALT with the token using setPool:`);
    logger.info(`      yarn svm:admin:set-pool \\`);
    logger.info(`        --token-mint ${tokenMint.toString()} \\`);
    logger.info(
      `        --lookup-table ${result.lookupTableAddress.toString()} \\`
    );
            logger.info(`        --writable-indices 3,4,7`);
    logger.info(
      `   3. The token will then be ready for CCIP cross-chain operations`
    );
  } catch (error) {
    logger.error("ALT creation failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔧 CCIP Token Pool Address Lookup Table Creator

Usage: yarn svm:admin:create-alt [options]

Required Options:
  --token-mint <address>           Token mint address
  --pool-program <address>         Pool program ID (e.g., burn-mint pool program)

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  # Create ALT with burn-mint pool (most common case)
  yarn svm:admin:create-alt \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --pool-program BurnMintTokenPoolProgram111111111111111111

  # With debug logging for troubleshooting
  yarn svm:admin:create-alt \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --pool-program BurnMintTokenPoolProgram111111111111111111 \\
    --log-level DEBUG

Notes:
  • ALT creation requires SOL for transaction fees
  • Fee quoter program ID is automatically loaded from CCIP configuration
  • Router program ID is automatically loaded from CCIP configuration
  • The created ALT contains all 10 addresses needed for token pool operations
  • After creation, use 'yarn svm:admin:set-pool' to register the ALT
  • Writable indices are typically [3, 4, 7] for burnmint pool_config, pool_token_account, pool_signer
  • ALT addresses are ordered exactly as required by the CCIP router program
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
