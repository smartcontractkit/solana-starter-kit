/**
 * Token Admin Registry Accept Admin Role Script
 *
 * This script accepts the administrator role for a token's admin registry.
 * Only the proposed administrator can execute this operation.
 *
 * This is step 2 of the two-step administrator transfer process. The current
 * signer must be the pending administrator that was previously proposed.
 *
 * The router address is automatically loaded from the configuration, ensuring
 * consistency with other CCIP scripts and reducing configuration errors.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. Ensure you are the proposed administrator for the token
 * 3. Provide the token mint address
 * 4. Run the script with: yarn svm:admin:accept-admin-role
 *
 * Required arguments:
 * --token-mint       : Token mint address
 *
 * Optional arguments:
 * --keypair          : Path to your keypair file
 * --log-level        : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight   : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:admin:accept-admin-role --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
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
 * Parse command line arguments specific to accepting admin role
 */
function parseAcceptAdminArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let tokenMint: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--token-mint":
        if (i + 1 < args.length) {
          tokenMint = args[i + 1];
          i++;
        }
        break;
    }
  }

  return {
    ...commonArgs,
    tokenMint,
  };
}

async function main() {
  // Parse arguments
  const options = parseAcceptAdminArgs();

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
  const logger = createLogger("admin-accept-admin-role", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Admin Registry Accept Admin Role");

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
    const signerAddress = walletKeypair.publicKey;
    const routerProgramId = config.routerProgramId; // Get router from config

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Signer (Proposed Admin): ${signerAddress.toString()}`);
    logger.info(`CCIP Router (from config): ${routerProgramId.toString()}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);
    logger.debug(`  Log level: ${options.logLevel}`);

    // Create token registry client using SDK directly
    const tokenRegistryClient = TokenRegistryClient.create(
      config.connection,
      walletKeypair,
      routerProgramId.toString(),
      {},
      { logLevel: options.logLevel ?? LogLevel.INFO }
    );

    // Check current token admin registry state
    logger.info("Checking current token admin registry...");
    logger.debug(`Checking registry for mint: ${tokenMint.toString()}`);

    try {
      const currentRegistry = await tokenRegistryClient.getTokenAdminRegistry(
        tokenMint
      );

      if (!currentRegistry) {
        logger.error("No token admin registry found for this token mint");
        logger.info(
          "The administrator must be proposed first using 'yarn svm:admin:propose-administrator'"
        );
        logger.info(
          `Use: yarn svm:admin:propose-administrator --token-mint ${tokenMint.toString()}`
        );
        process.exit(1);
      }

      logger.info(
        `Current administrator: ${currentRegistry.administrator.toString()}`
      );
      logger.info(
        `Current pending administrator: ${currentRegistry.pendingAdministrator.toString()}`
      );
      logger.info(`Lookup table: ${currentRegistry.lookupTable.toString()}`);

      // Check if signer is the pending administrator
      if (!currentRegistry.pendingAdministrator.equals(signerAddress)) {
        logger.error(`Signer is not the pending administrator for this token`);
        logger.error(
          `Pending administrator: ${currentRegistry.pendingAdministrator.toString()}`
        );
        logger.error(`Your address: ${signerAddress.toString()}`);
        logger.info("Only the pending administrator can accept the admin role");
        if (currentRegistry.pendingAdministrator.equals(PublicKey.default)) {
          logger.info(
            "No pending administrator set. Use 'yarn svm:admin:propose-administrator' first"
          );
        }
        process.exit(1);
      }

      // Check if the current admin is already set (shouldn't be the case normally)
      if (currentRegistry.administrator.equals(signerAddress)) {
        logger.info(
          "✅ You are already the current administrator for this token"
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
    } catch (error) {
      logger.error(`Could not fetch token admin registry: ${error}`);
      logger.info(
        "Ensure the administrator has been proposed first using 'yarn svm:admin:propose-administrator'"
      );
      process.exit(1);
    }

    // Accept the admin role
    logger.info("Accepting administrator role...");
    const signature = await tokenRegistryClient.acceptAdminRole({
      tokenMint,
    });

    logger.info(`Administrator role accepted successfully!`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(
      `Solana Explorer: ${getExplorerUrl(config.id, signature)}`
    );

    // Verify the role acceptance
    logger.info("Verifying administrator role acceptance...");
    logger.debug("Attempting to fetch registry to verify role transfer...");

    try {
      const updatedRegistry = await tokenRegistryClient.getTokenAdminRegistry(
        tokenMint
      );

      if (updatedRegistry) {
        const currentAdmin = updatedRegistry.administrator.toString();
        const pendingAdmin = updatedRegistry.pendingAdministrator.toString();

        if (updatedRegistry.administrator.equals(signerAddress)) {
          logger.info("✅ Administrator role transfer verified successfully!");
          logger.info(`New administrator: ${currentAdmin}`);
          logger.info(
            `Pending administrator: ${pendingAdmin} (should be default/cleared)`
          );

          logger.debug("Role transfer verification details:", {
            newAdministrator: currentAdmin,
            pendingAdministrator: pendingAdmin,
            signerAddress: signerAddress.toString(),
            lookupTable: updatedRegistry.lookupTable.toString(),
          });
        } else {
          logger.warn(
            "Administrator role acceptance completed but verification shows different admin"
          );
          logger.warn(`Expected: ${signerAddress.toString()}`);
          logger.warn(`Actual: ${currentAdmin}`);
        }

        logger.trace("Complete verification info:", updatedRegistry);

        logger.info("");
        logger.info("🎉 Administrator Role Transfer Complete!");
        logger.info(
          `   ✅ You are now the administrator for token ${tokenMint.toString()}`
        );
        logger.info(
          `   ✅ You can now manage pools and cross-chain configurations`
        );
        logger.info(
          `   ✅ Use token pool scripts to set up CCIP functionality`
        );

        logger.info("");
        logger.info("📋 Next Steps:");
        logger.info(`   • Set up token pools if needed`);
        logger.info(`   • Configure cross-chain settings`);
        logger.info(`   • Register pools with the token admin registry`);
      } else {
        logger.warn(
          "Administrator role acceptance succeeded but registry not found during verification"
        );
        logger.info(
          "This may be due to network delays - the role transfer should be recorded shortly"
        );
      }
    } catch (error) {
      logger.warn(
        `Administrator role acceptance succeeded but verification failed: ${error}`
      );
      logger.debug("Verification error details:", error);
      logger.info(
        "This may be due to network delays - the role transfer should be recorded shortly"
      );
    }
  } catch (error) {
    logger.error("Administrator role acceptance failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
✅ CCIP Token Admin Registry Role Acceptor

Usage: yarn svm:admin:accept-admin-role [options]

Required Options:
  --token-mint <address>           Token mint address

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  # Accept administrator role (you must be the pending administrator)
  yarn svm:admin:accept-admin-role \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

  # With debug logging
  yarn svm:admin:accept-admin-role \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --log-level DEBUG

Notes:
  • Only the pending administrator can accept the admin role
  • This is step 2 of a 2-step process - the admin must be proposed first
  • Router program ID is automatically loaded from CCIP configuration
  • Role acceptance requires SOL for transaction fees
  • Use 'yarn svm:admin:propose-administrator' for step 1 of the process
  • Once accepted, you become the administrator and can manage the token's CCIP settings
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
