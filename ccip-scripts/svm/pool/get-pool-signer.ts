/**
 * Token Pool Signer PDA Retrieval Script
 *
 * This script retrieves the Pool Signer PDA for a burn-mint token pool.
 * The Pool Signer PDA is used as the authority for token operations and
 * is essential for transferring mint authority to enable CCIP functionality.
 *
 * INSTRUCTIONS:
 * 1. Provide the token mint and pool program addresses
 * 2. Run the script to get the Pool Signer PDA
 * 3. Use this PDA address to transfer mint authority
 *
 * Required arguments:
 * --token-mint              : Token mint address
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 *
 * Optional arguments:
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 *
 * NOTE: This is a READ-ONLY operation that does not require a wallet or keypair.
 *
 * Example usage:
 * yarn svm:pool:get-pool-signer \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *   --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh
 */

import { PublicKey } from "@solana/web3.js";
import { findPoolSignerPDA } from "../../../ccip-lib/svm/utils/pdas/tokenpool";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { parseArgs } from "../utils/args-parser";

const SCRIPT_ARGS = [
  {
    name: "token-mint",
    description: "Token mint address",
    required: true,
    type: "string" as const,
  },
  {
    name: "burn-mint-pool-program",
    description: "Burn-mint token pool program ID",
    required: true,
    type: "string" as const,
  },
  {
    name: "log-level",
    description: "Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)",
    required: false,
    type: "string" as const,
  },
];

async function main() {
  // Check for help
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  // Parse arguments
  const options = parseArgs(SCRIPT_ARGS);

  // Create logger
  const logger = createLogger("get-pool-signer", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Pool Signer PDA Reader (Read-Only)");

  try {
    // Parse addresses
    const tokenMint = new PublicKey(options["token-mint"]);
    const burnMintPoolProgramId = new PublicKey(
      options["burn-mint-pool-program"]
    );

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Log level: ${options["log-level"]}`);

    // Derive the Pool Signer PDA
    logger.info("Deriving Pool Signer PDA...");
    const [poolSignerPDA, poolSignerBump] = findPoolSignerPDA(
      tokenMint,
      burnMintPoolProgramId
    );

    // Display the results
    logger.info(`Pool Signer PDA derived successfully! 🎉`);
    logger.info("");
    logger.info("📋 Pool Signer PDA Details:");
    logger.info("===========================");
    logger.info(`Address: ${poolSignerPDA.toString()}`);
    logger.info(`Bump Seed: ${poolSignerBump}`);
    logger.info("");

    logger.info("🔧 PDA Derivation:");
    logger.info(
      `  Seeds: ["ccip_tokenpool_signer", "${tokenMint.toString()}"]`
    );
    logger.info(`  Program: ${burnMintPoolProgramId.toString()}`);
    logger.info("");

    logger.info("📝 Usage Notes:");
    logger.info("  • This PDA serves as the authority for token operations");
    logger.info("  • Transfer mint authority to this address to enable CCIP");
    logger.info(
      "  • The pool program will use this PDA for burns/mints during cross-chain transfers"
    );
    logger.info("");

    logger.info("🔗 Next Steps:");
    logger.info("  1. Transfer mint authority to this PDA address");
    logger.info("  2. Verify the transfer using token program commands");
    logger.info(
      "  3. The token pool will then have authority for CCIP operations"
    );
    logger.info("");

    logger.info(
      "💡 Use this PDA address for mint authority transfer operations"
    );
  } catch (error) {
    logger.error("Failed to derive Pool Signer PDA:", error);
    logger.info("");
    logger.info("❌ Common Issues:");
    logger.info("  • Invalid token mint address format");
    logger.info("  • Invalid burn-mint pool program ID format");
    logger.info("");
    logger.info("💡 Solutions:");
    logger.info("  • Verify token mint address is a valid PublicKey");
    logger.info("  • Verify pool program ID is a valid PublicKey");
    logger.info("  • Check addresses for typos or formatting issues");
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔍 CCIP Token Pool Signer PDA Reader

Usage: yarn svm:pool:get-pool-signer [options]

Required Options:
  --token-mint <address>           Token mint address
  --burn-mint-pool-program <id>    Burn-mint token pool program ID

Optional Options:
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:get-pool-signer \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh

  yarn svm:pool:get-pool-signer \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --log-level DEBUG

Purpose:
  This script derives the Pool Signer PDA (Program Derived Address) for a burn-mint
  token pool. The Pool Signer PDA serves as the authority for token operations and
  is used to enable CCIP cross-chain functionality.

Notes:
  • This is a read-only operation that doesn't require a wallet
  • The PDA is deterministically derived from the token mint and program ID
  • Use the returned address to transfer mint authority to the token pool
  • The pool program uses this PDA for automated token operations during CCIP transfers
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
