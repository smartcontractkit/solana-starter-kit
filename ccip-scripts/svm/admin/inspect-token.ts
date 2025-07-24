/**
 * CCIP Token Configuration Inspector (CLI Framework Version)
 *
 * This script inspects existing CCIP-enabled tokens to analyze their configuration.
 * It reads the token admin registry, fetches the ALT data, decodes writable indices,
 * and compares with expected configurations.
 */

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { resolveNetworkConfig } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { LogLevel, createLogger, Logger } from "../../../ccip-lib/svm";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Options specific to the inspect-token command
 */
interface InspectTokenOptions extends BaseCommandOptions {
  tokenMint: string;
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
 * Inspect Token Command
 */
class InspectTokenCommand extends CCIPCommand<InspectTokenOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "inspect-token",
      description: "🔍 CCIP Token Configuration Inspector\n\nInspects existing CCIP-enabled tokens to analyze their configuration. Reads the token admin registry, fetches ALT data, decodes writable indices, and compares with expected configurations.",
      examples: [
        "# Inspect a CCIP-enabled token",
        "yarn svm:admin:inspect-token --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        "",
        "# With debug logging for detailed analysis",
        "yarn svm:admin:inspect-token --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --log-level DEBUG"
      ],
      notes: [
        "This is a read-only operation that doesn't modify any state",
        "Helps confirm correct writable indices configuration [3, 4, 7] for burn-mint tokens",
        "Shows all ALT addresses with their purposes and write permissions",
        "Compares with expected CCIP burn-mint configuration",
        "Validates configuration of existing CCIP tokens",
        "Useful for debugging token setup issues",
        "Provides reference for new token configurations"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "token-mint",
        required: true,
        type: "string",
        description: "Token mint address to inspect",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      }
    ];
  }

  /**
   * Analyze ALT configuration and compare with expected values
   */
  private analyzeALTConfiguration(
    addresses: PublicKey[],
    writableIndices: number[],
    tokenMint: PublicKey
  ) {
    const descriptions = getALTAddressDescriptions();
    const expectedWritable = [3, 4, 7]; // Expected writable indices for burn-mint tokens

    this.logger.info("");
    this.logger.info("📋 ALT CONFIGURATION ANALYSIS");
    this.logger.info(
      "================================================================================"
    );

    // Display all addresses with writable status
    this.logger.info(`ALT contains ${addresses.length} addresses:`);
    for (let i = 0; i < addresses.length; i++) {
      const isWritable = writableIndices.includes(i);
      const status = isWritable ? "🔓 WRITABLE" : "🔒 read-ONLY";
      const description = descriptions[i] || "Additional account";

      this.logger.info(
        `  [${i}]: ${addresses[i].toString()} (${description}) - ${status}`
      );
    }

    this.logger.info("");
    this.logger.info("🔍 WRITABLE INDICES ANALYSIS");
    this.logger.info("----------------------------------------");
    this.logger.info(`Current writable indices: [${writableIndices.join(", ")}]`);
    this.logger.info(`Expected writable indices: [${expectedWritable.join(", ")}]`);

    // Compare with expected configuration
    const isCorrectConfig =
      JSON.stringify(writableIndices.sort()) ===
      JSON.stringify(expectedWritable.sort());

    if (isCorrectConfig) {
      this.logger.info(
        "✅ Writable indices match expected configuration [3, 4, 7] for burn-mint tokens"
      );
    } else {
      this.logger.warn(
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
        this.logger.warn(`  Missing writable indices: [${missing.join(", ")}]`);
      }
      if (extra.length > 0) {
        this.logger.warn(`  Extra writable indices: [${extra.join(", ")}]`);
      }
    }

    this.logger.info("");
    this.logger.info("📝 EXPECTED WRITABLE ACCOUNTS:");
    expectedWritable.forEach((idx) => {
      const desc = descriptions[idx] || "Additional account";
      const addr = addresses[idx]?.toString() || "Not found in ALT";
      this.logger.info(`  [${idx}]: ${desc} - ${addr}`);
    });

    // Validate specific requirements
    this.logger.info("");
    this.logger.info("🔧 VALIDATION CHECKS");
    this.logger.info("----------------------------------------");

    // Check if token mint matches
    if (addresses.length > 7 && addresses[7].equals(tokenMint)) {
      this.logger.info("✅ Token mint matches ALT address at index 7");
    } else {
      this.logger.error("❌ Token mint mismatch in ALT");
    }

    // Check minimum required addresses
    if (addresses.length >= 10) {
      this.logger.info("✅ ALT contains minimum required addresses (10)");
    } else {
      this.logger.warn(`⚠️ ALT has only ${addresses.length} addresses (expected 10)`);
    }

    return {
      isCorrectConfig,
      currentWritable: writableIndices,
      expectedWritable,
      totalAddresses: addresses.length,
    };
  }

  protected async execute(): Promise<void> {
    this.logger.info("🔍 CCIP Token Configuration Inspector");
    this.logger.info("=========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (optional for read-only operations)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);

    let tokenMint: PublicKey;
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch {
      throw new Error(`Invalid token mint address: ${this.options.tokenMint}`);
    }

    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`CCIP Router Program: ${config.routerProgramId.toString()}`);
    this.logger.info(`Network: ${config.id}`);

    this.logger.debug(`Using keypair from ${keypairPath} for connection...`);

    try {
      // Create token registry client
      const tokenRegistryClient = TokenRegistryClient.create(
        config.connection,
        walletKeypair,
        config.routerProgramId.toString(),
        {},
        { logLevel: this.options.logLevel }
      );

      // Fetch token admin registry
      this.logger.info("");
      this.logger.info("📥 FETCHING TOKEN ADMIN REGISTRY");
      this.logger.info(
        "================================================================================"
      );

      const registry = await tokenRegistryClient.getTokenAdminRegistry(
        tokenMint
      );

      if (!registry) {
        this.logger.error("❌ No token admin registry found for this token");
        this.logger.info("This token is not registered with CCIP or doesn't exist");
        this.logger.info(
          `Use: yarn svm:admin:propose-administrator --token-mint ${tokenMint.toString()}`
        );
        throw new Error("Token admin registry not found");
      }

      // Display registry information
      this.logger.info("✅ Token admin registry found!");
      this.logger.info(`Administrator: ${registry.administrator.toString()}`);
      this.logger.info(
        `Pending Administrator: ${registry.pendingAdministrator.toString()}`
      );
      this.logger.info(`Lookup Table: ${registry.lookupTable.toString()}`);
      this.logger.info(`Mint: ${registry.mint.toString()}`);

      // Check if ALT is set
      const isALTSet = !registry.lookupTable.equals(PublicKey.default);

      if (!isALTSet) {
        this.logger.warn("⚠️ No ALT registered with this token");
        this.logger.info("The token has an admin registry but no pool is set");
        this.logger.info(
          `Use: yarn svm:admin:create-alt --token-mint ${tokenMint.toString()}`
        );
        this.logger.info(`Then: yarn svm:admin:set-pool to register the ALT`);
        return;
      }

      // Log raw writable indices before decoding (for debugging)
      this.logger.debug("Raw writable indices from registry:");
      this.logger.debug(
        `  writableIndexes: [${registry.writableIndexes
          .map((bn) => bn.toString())
          .join(", ")}]`
      );

      // Decode writable indices
      const writableIndices = decodeWritableIndices(
        registry.writableIndexes,
        this.logger
      );
      this.logger.info(`Writable Indices: [${writableIndices.join(", ")}]`);

      // Fetch ALT data
      this.logger.info("");
      this.logger.info("📥 FETCHING ADDRESS LOOKUP TABLE");
      this.logger.info(
        "================================================================================"
      );

      const { value: lookupTableAccount } =
        await config.connection.getAddressLookupTable(registry.lookupTable);

      if (!lookupTableAccount) {
        this.logger.error("❌ Address Lookup Table not found");
        this.logger.error(`ALT address: ${registry.lookupTable.toString()}`);
        this.logger.info("The registry points to an ALT that doesn't exist");
        throw new Error("Address Lookup Table not found");
      }

      this.logger.info("✅ Address Lookup Table found!");
      this.logger.info(`ALT Address: ${registry.lookupTable.toString()}`);
      this.logger.info(
        `Total Addresses: ${lookupTableAccount.state.addresses.length}`
      );
      this.logger.info(
        `Authority: ${lookupTableAccount.state.authority?.toString() || "None"}`
      );
      this.logger.info(
        `Last Extended Slot: ${lookupTableAccount.state.lastExtendedSlot}`
      );

      // Analyze configuration
      const analysis = this.analyzeALTConfiguration(
        lookupTableAccount.state.addresses,
        writableIndices,
        tokenMint
      );

      // Summary
      this.logger.info("");
      this.logger.info("📊 CONFIGURATION SUMMARY");
      this.logger.info(
        "================================================================================"
      );

      if (analysis.isCorrectConfig) {
        this.logger.info("🎉 CONFIGURATION IS CORRECT!");
        this.logger.info(
          "✅ This token follows the standard burn-mint CCIP configuration"
        );
        this.logger.info(
          "✅ Writable indices: [3, 4, 7] (Pool Config, Pool Token Account, Token Mint)"
        );
        this.logger.info("✅ Ready for CCIP cross-chain burn-mint operations");
      } else {
        this.logger.warn("⚠️ CONFIGURATION DIFFERS FROM STANDARD");
        this.logger.warn(
          "This token uses a non-standard writable indices configuration"
        );
        this.logger.warn(
          "This may be intentional for lock-release tokens or specific use cases"
        );
      }

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS FOR NEW TOKENS:");
      this.logger.info(
        "1. Create ALT: yarn svm:admin:create-alt --token-mint <mint> --pool-program <program>"
      );
      this.logger.info(
        "2. Set Pool: yarn svm:admin:set-pool --token-mint <mint> --lookup-table <alt> --writable-indices 3,4,7"
      );
      this.logger.info(
        "3. Test: Use this configuration as a reference for new token setups"
      );

      this.logger.info("");
      this.logger.info("🎉 Token Inspection Complete!");
      this.logger.info("✅ Configuration analysis finished successfully");

    } catch (error) {
      this.logger.error(
        `❌ Token inspection failed: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new InspectTokenCommand();
command.run().catch((error) => {
  process.exit(1);
});