/**
 * Token Admin Registry Propose Administrator Script
 *
 * This script proposes a new administrator for a token's admin registry.
 * Only the token owner (mint authority) can execute this operation.
 *
 * The router address is automatically loaded from the configuration, ensuring
 * consistency with other CCIP scripts and reducing configuration errors.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. Ensure you are the mint authority of the token
 * 3. Provide the token mint address
 * 4. Run the script with: yarn svm:admin:propose-administrator
 *
 * Required arguments:
 * --token-mint       : Token mint address
 *
 * Optional arguments:
 * --new-admin        : Address of the proposed new administrator (defaults to current signer)
 * --keypair          : Path to your keypair file
 * --log-level        : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight   : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:admin:propose-administrator --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
 * yarn svm:admin:propose-administrator --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --new-admin 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createTokenRegistryClient } from "../utils/client-factory";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to proposing administrator
 */
function parseProposeAdminArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let tokenMint: string | undefined;
  let newAdmin: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--token-mint":
        if (i + 1 < args.length) {
          tokenMint = args[i + 1];
          i++;
        }
        break;
      case "--new-admin":
        if (i + 1 < args.length) {
          newAdmin = args[i + 1];
          i++;
        }
        break;
    }
  }

  return {
    ...commonArgs,
    tokenMint,
    newAdmin,
  };
}

async function main() {
  // Parse arguments
  const options = parseProposeAdminArgs();

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

  // Create logger
  const logger = createLogger("admin-propose-administrator", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Admin Registry Propose Administrator");

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

    // Parse addresses - default new admin to current signer if not provided
    const tokenMint = new PublicKey(options.tokenMint);
    const newAdminPubkey = options.newAdmin
      ? new PublicKey(options.newAdmin)
      : walletKeypair.publicKey; // Default to current signer
    const routerProgramId = config.routerProgramId; // Get router from config

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`New Administrator: ${newAdminPubkey.toString()}`);
    if (!options.newAdmin) {
      logger.info(`  ℹ️ Using current signer as new admin (default behavior)`);
    }
    logger.info(`CCIP Router (from config): ${routerProgramId.toString()}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);
    logger.debug(`  Log level: ${options.logLevel}`);
    logger.debug(`  New admin explicitly provided: ${!!options.newAdmin}`);

    // Create token registry client
    const tokenRegistryClient = createTokenRegistryClient(
      routerProgramId.toString(),
      {
        keypairPath: keypairPath,
        logLevel: options.logLevel,
        skipPreflight: options.skipPreflight,
      }
    );

    // Check current token admin registry
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
        logger.info(`Lookup table: ${currentRegistry.lookupTable.toString()}`);

        // Check if the new admin is already the current admin
        if (currentRegistry.administrator.equals(newAdminPubkey)) {
          logger.info(
            "✅ The specified address is already the current administrator"
          );
          logger.info("No changes needed");
          return;
        }

        // Check if the new admin is already the pending admin
        if (currentRegistry.pendingAdministrator.equals(newAdminPubkey)) {
          logger.info(
            "✅ The specified address is already the pending administrator"
          );
          logger.info(
            "The proposed administrator needs to call acceptAdminRole to complete the transfer"
          );
          logger.info(
            `Use: yarn svm:admin:accept-admin-role --token-mint ${tokenMint.toString()}`
          );
          return;
        }

        logger.debug("Current registry details:", {
          administrator: currentRegistry.administrator.toString(),
          pendingAdministrator: currentRegistry.pendingAdministrator.toString(),
          lookupTable: currentRegistry.lookupTable.toString(),
          mint: currentRegistry.mint.toString(),
        });
      } else {
        logger.info("No existing token admin registry found");
        logger.info(
          "This will create a new registry with the proposed administrator"
        );
      }
    } catch (error) {
      logger.debug(
        `Could not fetch current registry (will create new): ${error}`
      );
    }

    // Propose the new administrator
    logger.info("Proposing new administrator...");
    const signature = await tokenRegistryClient.proposeAdministrator({
      tokenMint,
      newAdmin: newAdminPubkey,
    });

    logger.info(`Administrator proposed successfully!`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(
      `Solana Explorer: ${getExplorerUrl(config.id, signature)}`
    );

    // Verify the proposal
    logger.info("Verifying administrator proposal...");
    logger.debug("Attempting to fetch registry to verify proposal...");

    try {
      const updatedRegistry = await tokenRegistryClient.getTokenAdminRegistry(
        tokenMint
      );

      if (updatedRegistry) {
        const pendingAdmin = updatedRegistry.pendingAdministrator.toString();

        if (updatedRegistry.pendingAdministrator.equals(newAdminPubkey)) {
          logger.info("✅ Administrator proposal verified successfully!");
          logger.info(`Pending administrator: ${pendingAdmin}`);
          logger.info(
            `Current administrator: ${updatedRegistry.administrator.toString()}`
          );

          logger.debug("Proposal verification details:", {
            administrator: updatedRegistry.administrator.toString(),
            pendingAdministrator: pendingAdmin,
            proposedAdmin: newAdminPubkey.toString(),
            lookupTable: updatedRegistry.lookupTable.toString(),
          });
        } else {
          logger.warn(
            "Administrator proposal completed but verification shows different pending admin"
          );
          logger.warn(`Expected: ${newAdminPubkey.toString()}`);
          logger.warn(`Actual: ${pendingAdmin}`);
        }

        logger.trace("Complete verification info:", updatedRegistry);

        logger.info("");
        logger.info("📋 Next Steps:");
        if (newAdminPubkey.equals(walletKeypair.publicKey)) {
          // If proposing self as admin
          logger.info(
            `   1. You (${newAdminPubkey.toString()}) need to accept the admin role`
          );
          logger.info(
            `   2. Use: yarn svm:admin:accept-admin-role --token-mint ${tokenMint.toString()}`
          );
          logger.info(`   3. You can use the same keypair to accept the role`);
        } else {
          // If proposing someone else as admin
          logger.info(
            `   1. The proposed administrator (${newAdminPubkey.toString()}) must accept the role`
          );
          logger.info(
            `   2. They should use: yarn svm:admin:accept-admin-role --token-mint ${tokenMint.toString()}`
          );
          logger.info(
            `   3. They must use their own keypair to accept the role`
          );
        }
      } else {
        logger.warn(
          "Administrator proposal succeeded but registry not found during verification"
        );
        logger.info(
          "This may be due to network delays - the proposal should be recorded shortly"
        );
      }
    } catch (error) {
      logger.warn(
        `Administrator proposal succeeded but verification failed: ${error}`
      );
      logger.debug("Verification error details:", error);
      logger.info(
        "This may be due to network delays - the proposal should be recorded shortly"
      );
    }
  } catch (error) {
    logger.error("Administrator proposal failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
👤 CCIP Token Admin Registry Administrator Proposer

Usage: yarn svm:admin:propose-administrator [options]

Required Options:
  --token-mint <address>           Token mint address

Optional Options:
  --new-admin <address>            Address of the proposed new administrator
                                   (defaults to current signer if not provided)
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  # Propose yourself as administrator (most common case)
  yarn svm:admin:propose-administrator \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

  # Propose someone else as administrator
  yarn svm:admin:propose-administrator \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --new-admin 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T

  # With debug logging
  yarn svm:admin:propose-administrator \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --log-level DEBUG

Notes:
  • Only the token mint authority can propose an administrator
  • Router program ID is automatically loaded from CCIP configuration
  • If --new-admin is not provided, the current signer will be proposed as admin
  • This is step 1 of a 2-step process - the proposed admin must accept the role
  • Proposal requires SOL for transaction fees
  • Use 'yarn svm:admin:accept-admin-role' for the proposed admin to complete the transfer
  • Use 'yarn svm:admin:get-registry' to view current registry configuration
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
