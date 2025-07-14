/**
 * CCIP Address Lookup Table (ALT) Extension Script
 *
 * This script extends an existing Address Lookup Table by appending new addresses.
 * This is useful when you need to add additional accounts to an ALT after it has
 * been created, allowing for more flexible transaction composition.
 *
 * IMPORTANT CONSIDERATIONS:
 * - ALTs can hold up to 256 addresses maximum
 * - Each extend operation can add approximately 20-30 addresses per transaction
 * - You can only extend ALTs where you are the authority
 * - Extended addresses will be appended to the end of the existing addresses
 * - The ALT must "warm up" for 1 slot before new addresses can be used
 *
 * PREREQUISITES:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. You must be the authority of the ALT you want to extend
 * 3. Know the existing ALT address you want to extend
 * 4. Have the list of new addresses you want to add
 * 5. Run the script with: yarn svm:admin:extend-alt
 *
 * Required arguments:
 * --lookup-table-address : Address of the existing ALT to extend
 * --addresses            : Comma-separated list of addresses to add to the ALT
 *
 * Optional arguments:
 * --keypair              : Path to your keypair file
 * --log-level            : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight       : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:admin:extend-alt \
 *   --lookup-table-address Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M \
 *   --addresses "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,BurnMintTokenPoolProgram111111111111111111,TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { createErrorEnhancer } from "../../../ccip-lib/svm/utils/errors";
import { createTokenRegistryClient } from "./client";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
const MAX_ADDRESSES_PER_TX = 30; // Maximum addresses per extend transaction
// ========== END CONFIGURATION ==========

/**
 * Parse command line arguments specific to ALT extension
 */
function parseExtendAltArgs() {
  const commonArgs = parseCommonArgs();
  const args = process.argv.slice(2);

  let lookupTableAddress: string | undefined;
  let addresses: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--lookup-table-address":
        if (i + 1 < args.length) {
          lookupTableAddress = args[i + 1];
          i++;
        }
        break;
      case "--addresses":
        if (i + 1 < args.length) {
          addresses = args[i + 1];
          i++;
        }
        break;
    }
  }

  return {
    ...commonArgs,
    lookupTableAddress,
    addresses,
  };
}

async function main() {
  // Parse arguments
  const options = parseExtendAltArgs();

  // Check for help
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  // Validate required arguments
  if (!options.lookupTableAddress) {
    console.error("Error: --lookup-table-address is required");
    printUsage();
    process.exit(1);
  }

  if (!options.addresses) {
    console.error("Error: --addresses is required");
    printUsage();
    process.exit(1);
  }

  // Create logger
  const logger = createLogger("admin-extend-alt", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Address Lookup Table Extension");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

  // Get keypair path and load wallet
  const keypairPath = getKeypairPath(options);
  logger.info(`Loading keypair from ${keypairPath}...`);

  const errorContext = {
    operation: "extendALT",
    lookupTableAddress: options.lookupTableAddress,
  };
  const enhanceError = createErrorEnhancer(logger);

  try {
    // Load wallet keypair
    const walletKeypair = loadKeypair(keypairPath);
    const walletPublicKey = walletKeypair.publicKey;
    logger.info(`Wallet public key: ${walletPublicKey.toString()}`);

    // Check balance
    const balance = await config.connection.getBalance(walletPublicKey);
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
        `solana airdrop 1 ${walletPublicKey.toString()} --url devnet`
      );
      process.exit(1);
    }

    // Create token registry client
    const tokenRegistryClient = await createTokenRegistryClient(
      config.routerProgramId.toString(),
      config.connection
    );

    // Parse addresses
    const lookupTableAddress = new PublicKey(options.lookupTableAddress);
    const addressList = options.addresses
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0)
      .map((addr) => new PublicKey(addr));

    logger.info(`ALT Address: ${lookupTableAddress.toString()}`);
    logger.info(`Adding ${addressList.length} addresses to ALT`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options.skipPreflight}`);
    logger.debug(`  Log level: ${options.logLevel}`);

    // Verify the ALT exists and we have authority
    logger.info("Verifying ALT exists and checking authority...");
    const altAccount = await config.connection.getAddressLookupTable(
      lookupTableAddress
    );

    if (!altAccount.value) {
      throw new Error(
        `Address Lookup Table not found: ${lookupTableAddress.toString()}`
      );
    }

    const currentAuthority = altAccount.value.state.authority;
    if (!currentAuthority) {
      throw new Error(
        `ALT has no authority (frozen): ${lookupTableAddress.toString()}`
      );
    }

    if (!currentAuthority.equals(walletPublicKey)) {
      throw new Error(
        `You are not the authority of this ALT. Authority: ${currentAuthority.toString()}, Your key: ${walletPublicKey.toString()}`
      );
    }

    logger.info(
      `✅ ALT verified. Current authority: ${currentAuthority.toString()}`
    );
    logger.info(
      `✅ Current ALT contains ${altAccount.value.state.addresses.length} addresses`
    );

    // Check if ALT has space for new addresses
    const currentAddressCount = altAccount.value.state.addresses.length;
    const newAddressCount = addressList.length;
    const totalAfterExtend = currentAddressCount + newAddressCount;

    if (totalAfterExtend > 256) {
      throw new Error(
        `ALT capacity exceeded. Current: ${currentAddressCount}, Adding: ${newAddressCount}, Total would be: ${totalAfterExtend}, Max: 256`
      );
    }

    logger.info(
      `ALT capacity check passed: ${currentAddressCount} + ${newAddressCount} = ${totalAfterExtend} / 256`
    );

    // Log the addresses being added
    logger.info("Addresses to add:");
    addressList.forEach((addr, index) => {
      logger.info(`  [${currentAddressCount + index}]: ${addr.toString()}`);
    });

    // Check if we need multiple transactions due to size limits
    const addressBatches: PublicKey[][] = [];
    for (let i = 0; i < addressList.length; i += MAX_ADDRESSES_PER_TX) {
      addressBatches.push(addressList.slice(i, i + MAX_ADDRESSES_PER_TX));
    }

    logger.info(`Will process ${addressBatches.length} batch(es) of addresses`);

    // Process each batch using the client
    const signatures: string[] = [];
    for (let batchIndex = 0; batchIndex < addressBatches.length; batchIndex++) {
      const batch = addressBatches[batchIndex];
      logger.info(
        `Processing batch ${batchIndex + 1}/${addressBatches.length} with ${
          batch.length
        } addresses...`
      );

      try {
        // Use the token registry client to extend the ALT
        const result = await tokenRegistryClient.extendTokenPoolLookupTable({
          lookupTableAddress,
          newAddresses: batch,
        });

        signatures.push(result.signature);
        logger.info(
          `Batch ${batchIndex + 1} completed successfully! Transaction: ${
            result.signature
          }`
        );
        logger.info(`Explorer: ${getExplorerUrl(config.id, result.signature)}`);

        // Wait a bit between batches to avoid overwhelming the network
        if (batchIndex < addressBatches.length - 1) {
          logger.info("Waiting 2 seconds before next batch...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error(`Batch ${batchIndex + 1} failed:`, error);
        throw enhanceError(error, {
          ...errorContext,
          batch: (batchIndex + 1).toString(),
          batchSize: batch.length.toString(),
        });
      }
    }

    // Final verification
    logger.info("Verifying ALT extension...");
    const updatedAltAccount = await config.connection.getAddressLookupTable(
      lookupTableAddress
    );

    if (updatedAltAccount.value) {
      const finalAddressCount = updatedAltAccount.value.state.addresses.length;
      logger.info(
        `✅ ALT extension verified! Final address count: ${finalAddressCount}`
      );

      if (finalAddressCount === totalAfterExtend) {
        logger.info("✅ All addresses added successfully!");
      } else {
        logger.warn(
          `⚠️  Address count mismatch. Expected: ${totalAfterExtend}, Actual: ${finalAddressCount}`
        );
      }
    }

    logger.info("");
    logger.info("🎉 ALT Extension Complete!");
    logger.info(`   ✅ ALT Address: ${lookupTableAddress.toString()}`);
    logger.info(`   ✅ Added ${addressList.length} new addresses`);
    logger.info(`   ✅ Processed in ${addressBatches.length} transaction(s)`);
    logger.info(`   ✅ Transaction signatures:`);
    signatures.forEach((sig, index) => {
      logger.info(`      Batch ${index + 1}: ${sig}`);
    });
  } catch (error) {
    logger.error("ALT extension failed:", error);

    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔧 CCIP Address Lookup Table Extender

Usage: yarn svm:admin:extend-alt [options]

Required Options:
  --lookup-table-address <address>     Address of the existing ALT to extend
  --addresses <addr1,addr2,addr3>      Comma-separated list of addresses to add

Optional Options:
  --keypair <path>                     Path to wallet keypair file
  --log-level <level>                  Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                     Skip transaction preflight checks
  --help, -h                           Show this help message

Examples:
  # Add single address to ALT
  yarn svm:admin:extend-alt \\
    --lookup-table-address Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M \\
    --addresses "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

  # Add multiple addresses to ALT
  yarn svm:admin:extend-alt \\
    --lookup-table-address Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M \\
    --addresses "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,BurnMintTokenPoolProgram111111111111111111,TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

  # With debug logging
  yarn svm:admin:extend-alt \\
    --lookup-table-address Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M \\
    --addresses "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,BurnMintTokenPoolProgram111111111111111111" \\
    --log-level DEBUG

Notes:
  • ALT extension requires SOL for transaction fees
  • You must be the authority of the ALT you want to extend
  • ALTs have a maximum capacity of 256 addresses
  • Large address lists are automatically batched into multiple transactions (~30 addresses per tx)
  • Extended ALTs need 1 slot to "warm up" before new addresses can be used
  • New addresses are appended to the end of the existing address list
  • Use comma-separated format for multiple addresses (no spaces around commas)
  • ALT must not be frozen to allow extensions
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
