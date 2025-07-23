/**
 * Token Admin Registry Set Pool Script
 *
 * This script registers an Address Lookup Table (ALT) with a token's admin registry,
 * enabling the token for CCIP cross-chain operations. Only the token administrator
 * can execute this operation.
 *
 * The ALT must be created first using the create-alt script, which contains all
 * the necessary addresses for token pool operations in the exact order required
 * by the CCIP router program.
 *
 * PREREQUISITES:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. You must be the administrator for the token (use propose/accept-admin-role first)
 * 3. The ALT must already exist (use create-alt script first)
 * 4. Know the correct writable indices for the ALT (typically [3, 4, 7] for burnmint pool)
 * 5. Run the script with: yarn svm:admin:set-pool
 *
 * Required arguments:
 * --token-mint       : Token mint address
 * --lookup-table     : Address Lookup Table address (from create-alt script)
 * --writable-indices : Comma-separated writable indices (e.g., "3,4,7" for burn-mint tokens)
 *
 * Optional arguments:
 * --keypair          : Path to your keypair file
 * --log-level        : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight   : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:admin:set-pool \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *   --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T \
 *   --writable-indices 3,4,7
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to set pool
 */
function parseSetPoolArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let tokenMint: string | undefined;
  let lookupTable: string | undefined;
  let writableIndices: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--token-mint":
        if (i + 1 < args.length) {
          tokenMint = args[i + 1];
          i++;
        }
        break;
      case "--lookup-table":
        if (i + 1 < args.length) {
          lookupTable = args[i + 1];
          i++;
        }
        break;
      case "--writable-indices":
        if (i + 1 < args.length) {
          writableIndices = args[i + 1];
          i++;
        }
        break;
    }
  }

  return {
    ...commonArgs,
    tokenMint,
    lookupTable,
    writableIndices,
  };
}

async function main() {
  // Parse arguments
  const options = parseSetPoolArgs();

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

  if (!options.lookupTable) {
    console.error("Error: --lookup-table is required");
    printUsage();
    process.exit(1);
  }

  if (!options.writableIndices) {
    console.error("Error: --writable-indices is required");
    printUsage();
    process.exit(1);
  }

  // Create logger
  const logger = createLogger("admin-set-pool", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Admin Registry Set Pool");

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

    // Parse addresses and parameters
    const tokenMint = new PublicKey(options.tokenMint);
    const lookupTableAddress = new PublicKey(options.lookupTable);

    // Parse writable indices
    let writableIndices: number[];
    try {
      writableIndices = options.writableIndices
        .split(",")
        .map((index) => Number(index.trim()));

      // Validate indices are numbers
      if (writableIndices.some((index) => isNaN(index))) {
        throw new Error("All writable indices must be valid numbers");
      }
    } catch (error) {
      logger.error(
        "Invalid writable indices format. Use comma-separated numbers (e.g., '3,4,7' for burn-mint tokens)"
      );
      process.exit(1);
    }

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Lookup Table: ${lookupTableAddress.toString()}`);
    logger.info(`Writable Indices: [${writableIndices.join(", ")}]`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);
    logger.debug(`  Log level: ${options.logLevel}`);

    // Create token registry client
    const tokenRegistryClient = TokenRegistryClient.create(
      config.connection,
      walletKeypair,
      config.routerProgramId.toString(),
      {},
      { logLevel: options.logLevel }
    );

    // Check current token admin registry status
    logger.info("Checking current token admin registry...");
    logger.debug(`Checking registry for mint: ${tokenMint.toString()}`);

    try {
      const currentRegistry = await tokenRegistryClient.getTokenAdminRegistry(
        tokenMint
      );

      if (currentRegistry) {
        logger.info(
          `Current administrator: ${currentRegistry.administrator.toString()}`
        );
        logger.info(
          `Current pending administrator: ${currentRegistry.pendingAdministrator.toString()}`
        );
        logger.info(
          `Current lookup table: ${currentRegistry.lookupTable.toString()}`
        );

        // Check if signer is the administrator
        if (!currentRegistry.administrator.equals(walletKeypair.publicKey)) {
          logger.error("Signer is not the administrator of this token");
          logger.error(`Required: ${currentRegistry.administrator.toString()}`);
          logger.error(`Provided: ${walletKeypair.publicKey.toString()}`);
          logger.info("Only the token administrator can set the pool");
          process.exit(1);
        }

        // Check if lookup table is already set to the same value
        if (currentRegistry.lookupTable.equals(lookupTableAddress)) {
          logger.info(
            "✅ Lookup table is already set to the specified address"
          );
          logger.info("No changes needed");
          return;
        }

        logger.debug("Current registry details:", {
          administrator: currentRegistry.administrator.toString(),
          pendingAdministrator: currentRegistry.pendingAdministrator.toString(),
          lookupTable: currentRegistry.lookupTable.toString(),
          mint: currentRegistry.mint.toString(),
        });
      } else {
        logger.error("No token admin registry found for this token");
        logger.info(
          "You must first propose and accept an administrator for this token"
        );
        logger.info(
          `Use: yarn svm:admin:propose-administrator --token-mint ${tokenMint.toString()}`
        );
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to fetch token admin registry: ${error}`);
      logger.info(
        "Ensure the token has an admin registry before setting the pool"
      );
      process.exit(1);
    }

    // Verify the lookup table exists
    logger.info("Verifying lookup table exists...");
    logger.debug(`Checking ALT at address: ${lookupTableAddress.toString()}`);

    try {
      const { value: lookupTableAccount } =
        await config.connection.getAddressLookupTable(lookupTableAddress);

      if (!lookupTableAccount) {
        logger.error(
          `Lookup table not found: ${lookupTableAddress.toString()}`
        );
        logger.info(
          "Create the lookup table first using: yarn svm:admin:create-alt"
        );
        process.exit(1);
      }

      const addressCount = lookupTableAccount.state.addresses.length;
      logger.info(`Lookup table verified with ${addressCount} addresses`);

      if (addressCount < 7) {
        logger.warn(
          `Lookup table has only ${addressCount} addresses (expected at least 7 for CCIP operations)`
        );
        logger.info(
          "Ensure the lookup table was created with create-alt script"
        );
      }

      logger.debug("Lookup table details:", {
        address: lookupTableAddress.toString(),
        addressCount: addressCount,
        authority: lookupTableAccount.state.authority?.toString() || "None",
        lastExtendedSlot: lookupTableAccount.state.lastExtendedSlot,
      });
    } catch (error) {
      logger.error(`Failed to verify lookup table: ${error}`);
      logger.info("Ensure the lookup table address is correct and exists");
      process.exit(1);
    }

    // Set the pool (register ALT with token)
    logger.info("Setting pool (registering ALT with token)...");
    const signature = await tokenRegistryClient.setPool({
      tokenMint,
      lookupTable: lookupTableAddress,
      writableIndices,
    });

    logger.info(`Pool set successfully!`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(
      `Solana Explorer: ${getExplorerUrl(config.id, signature)}`
    );

    // Verify the pool was set
    logger.info("Verifying pool registration...");
    logger.debug("Attempting to fetch updated registry to verify pool...");

    try {
      const updatedRegistry = await tokenRegistryClient.getTokenAdminRegistry(
        tokenMint
      );

      if (updatedRegistry) {
        const currentLookupTable = updatedRegistry.lookupTable.toString();

        if (updatedRegistry.lookupTable.equals(lookupTableAddress)) {
          logger.info("✅ Pool registration verified successfully!");
          logger.info(`Registered lookup table: ${currentLookupTable}`);
          logger.info(`Writable indices: [${writableIndices.join(", ")}]`);

          logger.debug("Pool verification details:", {
            administrator: updatedRegistry.administrator.toString(),
            lookupTable: currentLookupTable,
            registeredLookupTable: lookupTableAddress.toString(),
            mint: updatedRegistry.mint.toString(),
          });
        } else {
          logger.warn(
            "Pool registration completed but verification shows different lookup table"
          );
          logger.warn(`Expected: ${lookupTableAddress.toString()}`);
          logger.warn(`Actual: ${currentLookupTable}`);
        }

        logger.trace("Complete verification info:", updatedRegistry);

        logger.info("");
        logger.info("🎉 Pool Registration Complete!");
        logger.info(`   ✅ Token: ${tokenMint.toString()}`);
        logger.info(`   ✅ ALT: ${lookupTableAddress.toString()}`);
        logger.info(`   ✅ Ready for CCIP cross-chain operations`);

        logger.info("");
        logger.info("📋 Next Steps:");
        logger.info(`   • The token is now enabled for CCIP transfers`);
        logger.info(
          `   • Test cross-chain operations using the CCIP router scripts`
        );
        logger.info(`   • Use yarn ccip:send to send tokens cross-chain`);
        logger.info(`   • Monitor transactions on CCIP Explorer`);
      } else {
        logger.warn(
          "Pool registration succeeded but registry not found during verification"
        );
        logger.info(
          "This may be due to network delays - the registration should be recorded shortly"
        );
      }
    } catch (error) {
      logger.warn(
        `Pool registration succeeded but verification failed: ${error}`
      );
      logger.debug("Verification error details:", error);
      logger.info(
        "This may be due to network delays - the registration should be recorded shortly"
      );
    }
  } catch (error) {
    logger.error("Pool registration failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🏊 CCIP Token Admin Registry Pool Setter

Usage: yarn svm:admin:set-pool [options]

Required Options:
  --token-mint <address>           Token mint address
  --lookup-table <address>         Address Lookup Table address (from create-alt script)
  --writable-indices <indices>     Comma-separated writable indices (e.g., "3,4,7" for burn-mint)

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  # Set pool with typical writable indices for burn-mint tokens (most common case)
  yarn svm:admin:set-pool \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T \\
    --writable-indices 3,4,7

  # With debug logging
  yarn svm:admin:set-pool \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T \\
    --writable-indices 3,4,7 \\
    --log-level DEBUG

Notes:
  • Only the token administrator can set the pool
  • The ALT must be created first using 'yarn svm:admin:create-alt'
  • Writable indices are typically [3, 4, 7] for burn-mint tokens (pool_config, pool_token_account, token_mint)
  • Pool registration requires SOL for transaction fees
  • This enables the token for CCIP cross-chain operations
  • Use 'yarn svm:admin:propose-administrator' and 'yarn svm:admin:accept-admin-role' to become administrator
  • Verify registration with token admin registry query tools
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
