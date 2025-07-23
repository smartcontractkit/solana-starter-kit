/**
 * Update Self-Served Allowed Global Config Script
 *
 * This script updates the global self-served allowed flag for a burn-mint token pool program.
 * This flag controls whether pool creators can initialize pools without being the program upgrade authority.
 *
 * Only the program upgrade authority can execute this operation.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have the program upgrade authority keypair
 * 2. Ensure you have SOL for transaction fees (at least 0.01 SOL)
 * 3. Provide the burn-mint pool program ID and desired self-served flag value
 * 4. Run the script with: yarn svm:pool:update-self-served-allowed
 *
 * Required arguments:
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 * --self-served-allowed     : Boolean flag (true or false)
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file (must be program upgrade authority)
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight          : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:update-self-served-allowed --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --self-served-allowed true
 *
 * IMPORTANT:
 * - This script must be run by the program upgrade authority
 * - Setting to 'true' allows anyone with mint authority to create pools
 * - Setting to 'false' restricts pool creation to the program upgrade authority only
 * - This affects all future pool creations but does not impact existing pools
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType } from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to updating self-served allowed flag
 */
function parseUpdateSelfServedAllowedArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let burnMintPoolProgram: string | undefined;
  let selfServedAllowedStr: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--burn-mint-pool-program":
        if (i + 1 < args.length) {
          burnMintPoolProgram = args[i + 1];
          i++;
        }
        break;
      case "--self-served-allowed":
        if (i + 1 < args.length) {
          selfServedAllowedStr = args[i + 1];
          i++;
        }
        break;
    }
  }

  // Parse boolean value
  let selfServedAllowed: boolean | undefined;
  if (selfServedAllowedStr !== undefined) {
    const lowerValue = selfServedAllowedStr.toLowerCase();
    if (lowerValue === "true" || lowerValue === "1") {
      selfServedAllowed = true;
    } else if (lowerValue === "false" || lowerValue === "0") {
      selfServedAllowed = false;
    }
  }

  return {
    ...commonArgs,
    burnMintPoolProgram,
    selfServedAllowed,
    selfServedAllowedStr, // Keep original string for error reporting
  };
}

async function main() {
  // Parse arguments
  const options = parseUpdateSelfServedAllowedArgs();

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

  if (options.selfServedAllowed === undefined) {
    console.error(
      "Error: --self-served-allowed is required and must be 'true' or 'false'"
    );
    if (options.selfServedAllowedStr) {
      console.error(`Invalid value: '${options.selfServedAllowedStr}'`);
    }
    printUsage();
    process.exit(1);
  }

  // Create logger
  const logger = createLogger("update-self-served-allowed", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Pool Update Self-Served Allowed Flag");
  logger.warn("⚠️  This must be run by the program upgrade authority");

  // Load configuration
  // Resolve network configuration based on options
  const config = resolveNetworkConfig(options);

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
    const selfServedAllowed = options.selfServedAllowed!;

    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`New Self-Served Allowed: ${selfServedAllowed}`);

    if (selfServedAllowed) {
      logger.info(
        "🔓 Pool creation will be allowed for mint authority holders"
      );
    } else {
      logger.info(
        "🔒 Pool creation will be restricted to program upgrade authority only"
      );
    }

    logger.debug(`Update self-served allowed details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Authority: ${walletKeypair.publicKey.toString()}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);

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
      { logLevel: options.logLevel !== undefined ? options.logLevel : LogLevel.INFO }
    );

    const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

    // Get current global config to show current value
    logger.info("Fetching current global configuration...");
    try {
      const globalConfig = await tokenPoolClient.getGlobalConfigInfo();
      const currentValue = globalConfig.config.self_served_allowed;
      logger.info(`Current self-served allowed: ${currentValue}`);

      if (currentValue === selfServedAllowed) {
        logger.info(
          "✅ Self-served allowed flag is already set to the desired value"
        );
        logger.info("No changes needed");
        return;
      }

      logger.debug("Current global config details:", {
        version: globalConfig.config.version,
        selfServedAllowed: currentValue,
        router: globalConfig.config.router.toString(),
        rmnRemote: globalConfig.config.rmn_remote.toString(),
      });
    } catch (error) {
      logger.warn(`Could not fetch current global config: ${error}`);
      logger.debug("Global config fetch error:", error);
      logger.info("Proceeding with update...");
    }

    // Update the self-served allowed flag
    logger.info("Updating self-served allowed flag...");
    logger.info("📋 This updates the program-wide configuration");
    logger.debug("Calling SDK updateSelfServedAllowed method...");
    logger.debug(`Transaction options: skipPreflight=${options.skipPreflight}`);

    const signature = await tokenPoolClient.updateSelfServedAllowed({
      selfServedAllowed: selfServedAllowed,
      skipPreflight: options.skipPreflight,
    });

    logger.debug(`Transaction completed with signature: ${signature}`);

    logger.info(`Self-served allowed flag updated successfully! 🎉`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);

    // Verify the update
    logger.info("Verifying self-served allowed flag update...");
    logger.debug("Attempting to fetch global config to verify update...");
    try {
      const updatedGlobalConfig = await tokenPoolClient.getGlobalConfigInfo();
      const updatedValue = updatedGlobalConfig.config.self_served_allowed;

      if (updatedValue === selfServedAllowed) {
        logger.info(
          "✅ Self-served allowed flag update verified successfully!"
        );
        logger.info(`Updated value: ${updatedValue}`);
        logger.debug("Update verification details:", {
          previousValue: "N/A", // We could store this from before if needed
          newValue: updatedValue,
          version: updatedGlobalConfig.config.version,
        });
      } else {
        logger.warn("Update completed but verification shows different value");
        logger.warn(`Expected: ${selfServedAllowed}`);
        logger.warn(`Actual: ${updatedValue}`);
      }

      logger.trace("Complete verification info:", updatedGlobalConfig);
    } catch (error) {
      logger.warn(
        `Update transaction succeeded but verification failed: ${error}`
      );
      logger.debug("Verification error details:", error);
      logger.info(
        "This may be due to network delays - the flag should be updated shortly"
      );
    }

    logger.info("");
    logger.info("✅ Self-served allowed flag update completed!");
    logger.info("");

    if (selfServedAllowed) {
      logger.info(
        "Effect: Token holders with mint authority can now create pools"
      );
      logger.info("Security: Ensure only trusted token mints use this feature");
    } else {
      logger.info(
        "Effect: Only program upgrade authority can create new pools"
      );
      logger.info("Security: Maximum control over pool creation");
    }
  } catch (error) {
    logger.error("Self-served allowed flag update failed:", error);

    // Provide helpful error context
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        logger.error("");
        logger.error("🚨 Authorization Error:");
        logger.error(
          "   The wallet is not the program upgrade authority for this program."
        );
        logger.error(
          "   Only the program upgrade authority can update global config settings."
        );
      }
    }

    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔧 CCIP Global Config Self-Served Allowed Updater

Usage: yarn svm:pool:update-self-served-allowed [options]

Required Options:
  --burn-mint-pool-program <id>    Burn-mint token pool program ID
  --self-served-allowed <bool>     Allow self-served pool creation (true/false)

Optional Options:
  --keypair <path>                 Path to wallet keypair file (must be upgrade authority)
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  # Allow mint authority holders to create pools
  yarn svm:pool:update-self-served-allowed \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --self-served-allowed true

  # Restrict pool creation to upgrade authority only
  yarn svm:pool:update-self-served-allowed \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --self-served-allowed false

  # With debug logging
  yarn svm:pool:update-self-served-allowed \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --self-served-allowed true \\
    --log-level DEBUG

IMPORTANT NOTES:
  • This script MUST be run by the program upgrade authority
  • Setting to 'true' allows anyone with mint authority to create pools
  • Setting to 'false' restricts pool creation to upgrade authority only
  • This affects ALL future pool creations across the program
  • Existing pools are not affected by this change
  • Consider security implications before enabling self-served mode
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
