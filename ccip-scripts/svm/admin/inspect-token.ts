/**
 * CCIP Token Configuration Inspector
 *
 * This script inspects existing CCIP-enabled tokens to analyze their configuration.
 * It reads the token admin registry, fetches the ALT data, decodes writable indices,
 * and compares with expected configurations.
 *
 * USAGE:
 * This tool helps validate and compare token configurations with existing tokens
 * to ensure correct setup for new tokens.
 *
 * Required arguments:
 * --token-mint       : Token mint address to inspect
 *
 * Optional arguments:
 * --keypair          : Path to your keypair file
 * --log-level        : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 *
 * Example usage:
 * yarn svm:admin:inspect-token \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
 */

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig } from "../../config";
import { loadKeypair, parseCommonArgs, getKeypairPath } from "../utils";
import { LogLevel, createLogger, Logger } from "../../../ccip-lib/svm";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";

/**
 * Parse command line arguments specific to token inspection
 */
function parseInspectTokenArgs() {
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

/**
 * Decode writable indices bitmap to readable format
 */
function decodeWritableIndices(
  writableIndexes: BN[],
  logger?: Logger
): number[] {
  // Log raw writable indexes for debugging
  if (logger) {
    logger.debug("Raw writable indexes before decoding:");
    writableIndexes.forEach((bn, index) => {
      logger.debug(
        `  [${index}]: ${bn.toString()} (hex: 0x${bn.toString(16)})`
      );
    });
  }

  const writableList: number[] = [];

  // Process both 128-bit values in the array
  for (let bnIndex = 0; bnIndex < writableIndexes.length; bnIndex++) {
    const bitmap = writableIndexes[bnIndex];

    // Check each bit position
    for (let bitPos = 0; bitPos < 128; bitPos++) {
      // Calculate the actual index based on the rust implementation
      const actualIndex = bnIndex === 0 ? bitPos : 128 + bitPos;

      // Create a mask to check if this bit is set
      const mask = new BN(1).shln(bnIndex === 0 ? 127 - bitPos : 255 - bitPos);

      // Check if the bit is set
      if (!bitmap.and(mask).isZero()) {
        writableList.push(actualIndex);
      }
    }
  }

  return writableList.sort((a, b) => a - b);
}

/**
 * Get ALT address descriptions for better understanding
 */
function getALTAddressDescriptions(): string[] {
  return [
    "Lookup table itself",
    "Token admin registry PDA",
    "Pool program ID",
    "Pool configuration PDA",
    "Pool token account (ATA)",
    "Pool signer PDA",
    "Token program ID",
    "Token mint",
    "Fee billing token config PDA",
    "CCIP router pool signer PDA",
  ];
}

/**
 * Analyze ALT configuration and compare with expected values
 */
function analyzeALTConfiguration(
  addresses: PublicKey[],
  writableIndices: number[],
  tokenMint: PublicKey,
  logger: Logger
) {
  const descriptions = getALTAddressDescriptions();
  const expectedWritable = [3, 4, 7]; // Expected writable indices for burn-mint tokens

  logger.info("");
  logger.info("📋 ALT CONFIGURATION ANALYSIS");
  logger.info(
    "================================================================================"
  );

  // Display all addresses with writable status
  logger.info(`ALT contains ${addresses.length} addresses:`);
  for (let i = 0; i < addresses.length; i++) {
    const isWritable = writableIndices.includes(i);
    const status = isWritable ? "🔓 WRITABLE" : "🔒 READ-ONLY";
    const description = descriptions[i] || "Additional account";

    logger.info(
      `  [${i}]: ${addresses[i].toString()} (${description}) - ${status}`
    );
  }

  logger.info("");
  logger.info("🔍 WRITABLE INDICES ANALYSIS");
  logger.info("----------------------------------------");
  logger.info(`Current writable indices: [${writableIndices.join(", ")}]`);
  logger.info(`Expected writable indices: [${expectedWritable.join(", ")}]`);

  // Compare with expected configuration
  const isCorrectConfig =
    JSON.stringify(writableIndices.sort()) ===
    JSON.stringify(expectedWritable.sort());

  if (isCorrectConfig) {
    logger.info(
      "✅ Writable indices match expected configuration [3, 4, 7] for burn-mint tokens"
    );
  } else {
    logger.warn(
      "⚠️ Writable indices differ from expected configuration [3, 4, 7] for burn-mint tokens"
    );

    // Show differences
    const missing = expectedWritable.filter(
      (idx) => !writableIndices.includes(idx)
    );
    const extra = writableIndices.filter(
      (idx) => !expectedWritable.includes(idx)
    );

    if (missing.length > 0) {
      logger.warn(`  Missing writable indices: [${missing.join(", ")}]`);
    }
    if (extra.length > 0) {
      logger.warn(`  Extra writable indices: [${extra.join(", ")}]`);
    }
  }

  logger.info("");
  logger.info("📝 EXPECTED WRITABLE ACCOUNTS:");
  expectedWritable.forEach((idx) => {
    const desc = descriptions[idx] || "Additional account";
    const addr = addresses[idx]?.toString() || "Not found in ALT";
    logger.info(`  [${idx}]: ${desc} - ${addr}`);
  });

  // Validate specific requirements
  logger.info("");
  logger.info("🔧 VALIDATION CHECKS");
  logger.info("----------------------------------------");

  // Check if token mint matches
  if (addresses.length > 7 && addresses[7].equals(tokenMint)) {
    logger.info("✅ Token mint matches ALT address at index 7");
  } else {
    logger.error("❌ Token mint mismatch in ALT");
  }

  // Check minimum required addresses
  if (addresses.length >= 10) {
    logger.info("✅ ALT contains minimum required addresses (10)");
  } else {
    logger.warn(`⚠️ ALT has only ${addresses.length} addresses (expected 10)`);
  }

  return {
    isCorrectConfig,
    currentWritable: writableIndices,
    expectedWritable,
    totalAddresses: addresses.length,
  };
}

async function main() {
  // Parse arguments
  const options = parseInspectTokenArgs();

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
  const logger = createLogger("admin-inspect-token", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Configuration Inspector");

  // Load configuration
  // Resolve network configuration based on options
  const config = resolveNetworkConfig(options);

  // Get keypair path and load wallet (optional for read-only operations)
  const keypairPath = getKeypairPath(options);
  logger.debug(`Using keypair from ${keypairPath} for connection...`);

  try {
    const walletKeypair = loadKeypair(keypairPath);
    const tokenMint = new PublicKey(options.tokenMint);

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`CCIP Router Program: ${config.routerProgramId.toString()}`);
    logger.info(`Network: ${config.id}`);

    // Create token registry client
    const tokenRegistryClient = TokenRegistryClient.create(
      config.connection,
      walletKeypair,
      config.routerProgramId.toString(),
      {},
      { logLevel: options.logLevel }
    );

    // Fetch token admin registry
    logger.info("");
    logger.info("📥 FETCHING TOKEN ADMIN REGISTRY");
    logger.info(
      "================================================================================"
    );

    const registry = await tokenRegistryClient.getTokenAdminRegistry(
      tokenMint
    );

    if (!registry) {
      logger.error("❌ No token admin registry found for this token");
      logger.info("This token is not registered with CCIP or doesn't exist");
      logger.info(
        `Use: yarn svm:admin:propose-administrator --token-mint ${tokenMint.toString()}`
      );
      process.exit(1);
    }

    // Display registry information
    logger.info("✅ Token admin registry found!");
    logger.info(`Administrator: ${registry.administrator.toString()}`);
    logger.info(
      `Pending Administrator: ${registry.pendingAdministrator.toString()}`
    );
    logger.info(`Lookup Table: ${registry.lookupTable.toString()}`);
    logger.info(`Mint: ${registry.mint.toString()}`);

    // Check if ALT is set
    const isALTSet = !registry.lookupTable.equals(PublicKey.default);

    if (!isALTSet) {
      logger.warn("⚠️ No ALT registered with this token");
      logger.info("The token has an admin registry but no pool is set");
      logger.info(
        `Use: yarn svm:admin:create-alt --token-mint ${tokenMint.toString()}`
      );
      logger.info(`Then: yarn svm:admin:set-pool to register the ALT`);
      return;
    }

    // Log raw writable indices before decoding (for debugging)
    logger.debug("Raw writable indices from registry:");
    logger.debug(
      `  writableIndexes: [${registry.writableIndexes
        .map((bn) => bn.toString())
        .join(", ")}]`
    );

    // Decode writable indices
    const writableIndices = decodeWritableIndices(
      registry.writableIndexes,
      logger
    );
    logger.info(`Writable Indices: [${writableIndices.join(", ")}]`);

    // Fetch ALT data
    logger.info("");
    logger.info("📥 FETCHING ADDRESS LOOKUP TABLE");
    logger.info(
      "================================================================================"
    );

    const { value: lookupTableAccount } =
      await config.connection.getAddressLookupTable(registry.lookupTable);

    if (!lookupTableAccount) {
      logger.error("❌ Address Lookup Table not found");
      logger.error(`ALT address: ${registry.lookupTable.toString()}`);
      logger.info("The registry points to an ALT that doesn't exist");
      process.exit(1);
    }

    logger.info("✅ Address Lookup Table found!");
    logger.info(`ALT Address: ${registry.lookupTable.toString()}`);
    logger.info(
      `Total Addresses: ${lookupTableAccount.state.addresses.length}`
    );
    logger.info(
      `Authority: ${lookupTableAccount.state.authority?.toString() || "None"}`
    );
    logger.info(
      `Last Extended Slot: ${lookupTableAccount.state.lastExtendedSlot}`
    );

    // Analyze configuration
    const analysis = analyzeALTConfiguration(
      lookupTableAccount.state.addresses,
      writableIndices,
      tokenMint,
      logger
    );

    // Summary
    logger.info("");
    logger.info("📊 CONFIGURATION SUMMARY");
    logger.info(
      "================================================================================"
    );

    if (analysis.isCorrectConfig) {
      logger.info("🎉 CONFIGURATION IS CORRECT!");
      logger.info(
        "✅ This token follows the standard burn-mint CCIP configuration"
      );
      logger.info(
        "✅ Writable indices: [3, 4, 7] (Pool Config, Pool Token Account, Token Mint)"
      );
      logger.info("✅ Ready for CCIP cross-chain burn-mint operations");
    } else {
      logger.warn("⚠️ CONFIGURATION DIFFERS FROM STANDARD");
      logger.warn(
        "This token uses a non-standard writable indices configuration"
      );
      logger.warn(
        "This may be intentional for lock-release tokens or specific use cases"
      );
    }

    logger.info("");
    logger.info("📋 NEXT STEPS FOR NEW TOKENS:");
    logger.info(
      "1. Create ALT: yarn svm:admin:create-alt --token-mint <mint> --pool-program <program>"
    );
    logger.info(
      "2. Set Pool: yarn svm:admin:set-pool --token-mint <mint> --lookup-table <alt> --writable-indices 3,4,7"
    );
    logger.info(
      "3. Test: Use this configuration as a reference for new token setups"
    );
  } catch (error) {
    logger.error("Token inspection failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔍 CCIP Token Configuration Inspector

Usage: yarn svm:admin:inspect-token [options]

Required Options:
  --token-mint <address>           Token mint address to inspect

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --help, -h                       Show this help message

Examples:
  # Inspect a known CCIP-enabled token
  yarn svm:admin:inspect-token \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

  # With debug logging for detailed analysis
  yarn svm:admin:inspect-token \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --log-level DEBUG

Use Cases:
  • Validate configuration of existing CCIP tokens
  • Compare writable indices with reference implementations
  • Debug token setup issues
  • Understand ALT structure for new token configurations
  • Verify token admin registry settings

  Notes:
  • This is a read-only operation that doesn't modify any state
  • Helps confirm correct writable indices configuration [3, 4, 7] for burn-mint tokens
  • Shows all ALT addresses with their purposes and write permissions
  • Compares with expected CCIP burn-mint configuration
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
