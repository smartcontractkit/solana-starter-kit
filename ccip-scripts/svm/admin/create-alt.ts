/**
 * CCIP Token Pool Address Lookup Table (ALT) Creation Script (CLI Framework Version)
 *
 * This script creates an Address Lookup Table for a token pool with all necessary addresses
 * required for CCIP token operations. The ALT is essential for efficient cross-chain
 * transactions as it reduces transaction size by allowing address references instead of
 * full public keys.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for ALT creation operations
 */
const ALT_CREATION_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
  altAddressCount: 10,
};

/**
 * Options specific to the create-alt command
 */
interface CreateAltOptions extends BaseCommandOptions {
  tokenMint: string;
  poolProgram: string;
  additionalAddresses?: string;
}

/**
 * ALT Address descriptions for logging
 */
const ALT_ADDRESS_DESCRIPTIONS = [
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

/**
 * CCIP Token Pool Address Lookup Table Creation Command
 */
class CreateAltCommand extends CCIPCommand<CreateAltOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "create-alt",
      description: "🔧 CCIP Token Pool ALT Creator\\n\\nCreates an Address Lookup Table for a token pool with all necessary addresses required for CCIP token operations. The ALT reduces transaction size by allowing address references instead of full public keys.",
      examples: [
        "# Create ALT with burn-mint pool (most common case)",
        "yarn svm:admin:create-alt --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --pool-program BurnMintTokenPoolProgram111111111111111111",
        "",
        "# With debug logging for troubleshooting",
        "yarn svm:admin:create-alt --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --pool-program BurnMintTokenPoolProgram111111111111111111 --log-level DEBUG"
      ],
      notes: [
        "ALT creation requires SOL for transaction fees",
        "Fee quoter program ID is automatically loaded from CCIP configuration",
        "Router program ID is automatically loaded from CCIP configuration",
        `The created ALT contains all ${ALT_CREATION_CONFIG.altAddressCount} addresses needed for token pool operations`,
        "Additional custom addresses can be specified with --additional-addresses (comma-separated)",
        "All addresses (base + additional) are created in a single transaction",
        "ALT capacity is limited to 256 total addresses (246 max additional after base 10)",
        "After creation, use 'yarn svm:admin:set-pool' to register the ALT",
        "Writable indices are typically [3, 4, 7] for pool_config, pool_token_account, pool_signer",
        "ALT addresses are ordered exactly as required by the CCIP router program",
        "Additional addresses are appended after the base CCIP addresses",
        `Minimum ${ALT_CREATION_CONFIG.minSolRequired} SOL required for transaction fees`
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
        description: "Token mint address",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "pool-program",
        required: true,
        type: "string",
        description: "Pool program ID (e.g., burn-mint pool program)",
        example: "BurnMintTokenPoolProgram111111111111111111"
      },
      {
        name: "additional-addresses",
        required: false,
        type: "string",
        description: "Comma-separated list of additional addresses to include in the ALT",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
      }
    ];
  }

  /**
   * Validate ALT creation configuration
   */
  private validateConfig(): { additionalAddresses: PublicKey[] } {
    const errors: string[] = [];

    // Validate token mint address
    try {
      new PublicKey(this.options.tokenMint);
    } catch {
      errors.push("Invalid token mint address format");
    }

    // Validate pool program address
    try {
      new PublicKey(this.options.poolProgram);
    } catch {
      errors.push("Invalid pool program address format");
    }

    // Parse and validate additional addresses
    let additionalAddresses: PublicKey[] = [];
    if (this.options.additionalAddresses) {
      try {
        const addressStrings = this.options.additionalAddresses
          .split(",")
          .map((addr) => addr.trim())
          .filter((addr) => addr.length > 0);

        additionalAddresses = addressStrings.map((addr) => {
          try {
            return new PublicKey(addr);
          } catch {
            errors.push(`Invalid additional address format: ${addr}`);
            throw new Error("Invalid address format");
          }
        });

        // Check for capacity constraints (ALT max is 256, we use 10 for default addresses)
        const maxAdditional = 256 - ALT_CREATION_CONFIG.altAddressCount;
        if (additionalAddresses.length > maxAdditional) {
          errors.push(`Too many additional addresses. Maximum allowed: ${maxAdditional}, provided: ${additionalAddresses.length}`);
        }
      } catch {
        errors.push("Failed to parse additional addresses");
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`
      );
    }

    return { additionalAddresses };
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Token Pool Address Lookup Table Creation");
    this.logger.info("===================================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("===================================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < ALT_CREATION_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${ALT_CREATION_CONFIG.minSolRequired} SOL for transaction fees. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration and parse additional addresses
    const { additionalAddresses } = this.validateConfig();

    // Parse addresses
    const tokenMint = new PublicKey(this.options.tokenMint);
    const poolProgramId = new PublicKey(this.options.poolProgram);
    const feeQuoterProgramId = config.feeQuoterProgramId;
    const routerProgramId = config.routerProgramId;

    this.logger.info("");
    this.logger.info("⚙️  ALT CONFIGURATION");
    this.logger.info("===================================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Pool Program: ${poolProgramId.toString()}`);
    this.logger.info(`Fee Quoter Program: ${feeQuoterProgramId.toString()}`);
    this.logger.info(`Router Program: ${routerProgramId.toString()}`);
    this.logger.info(`Token Program: Auto-detected from on-chain mint data`);
    
    if (additionalAddresses.length > 0) {
      this.logger.info(`Additional Addresses: ${additionalAddresses.length} addresses to be added`);
    }

    this.logger.debug("");
    this.logger.debug("🔍 CONFIGURATION DETAILS");
    this.logger.debug("===================================================");
    this.logger.debug(`Network: ${config.id}`);
    this.logger.debug(`Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`Skip preflight: ${this.options.skipPreflight}`);
    this.logger.debug(`Log level: ${this.options.logLevel}`);

    // Create SDK token registry client
    const sdkClient = TokenRegistryClient.create(
      config.connection,
      walletKeypair,
      routerProgramId.toString(),
      {},
      { logLevel: this.options.logLevel }
    );

    // Create the ALT with all addresses in one transaction
    this.logger.info("");
    this.logger.info("🏗️  CREATING ADDRESS LOOKUP TABLE");
    this.logger.info("===================================================");
    const result = await sdkClient.createTokenPoolLookupTable({
      tokenMint,
      poolProgramId,
      feeQuoterProgramId,
      additionalAddresses: additionalAddresses.length > 0 ? additionalAddresses : undefined,
    });

    // Display results
    this.logger.info("");
    this.logger.info("✅ ALT CREATED SUCCESSFULLY");
    this.logger.info("===================================================");
    this.logger.info(`ALT Address: ${result.lookupTableAddress.toString()}`);
    this.logger.info(`Transaction Signature: ${result.signature}`);
    this.logger.info(`Total Addresses Count: ${result.addresses.length}`);
    if (additionalAddresses.length > 0) {
      this.logger.info(`Base CCIP Addresses: ${ALT_CREATION_CONFIG.altAddressCount}`);
      this.logger.info(`Additional Custom Addresses: ${additionalAddresses.length}`);
    }

    // Log ALT contents for verification
    this.logger.info("");
    this.logger.info("📋 ALT CONTENTS");
    this.logger.info("===================================================");
    
    result.addresses.forEach((addr, index) => {
      if (index < ALT_CREATION_CONFIG.altAddressCount) {
        // Base CCIP address
        const description = ALT_ADDRESS_DESCRIPTIONS[index] || "Base CCIP account";
        this.logger.info(`[${index}]: ${addr.toString()} (${description})`);
      } else {
        // Additional custom address
        const customIndex = index - ALT_CREATION_CONFIG.altAddressCount + 1;
        this.logger.info(`[${index}]: ${addr.toString()} (Custom address ${customIndex})`);
      }
    });

    // Display explorer URL
    this.logger.info("");
    this.logger.info("🔍 EXPLORER URLS");
    this.logger.info("===================================================");
    this.logger.info(`Transaction: ${getExplorerUrl(config.id, result.signature)}`);

    this.logger.info("");
    this.logger.info("🎉 ALT Creation Complete!");
    this.logger.info(`✅ Address Lookup Table: ${result.lookupTableAddress.toString()}`);
    this.logger.info(`✅ Contains ${ALT_CREATION_CONFIG.altAddressCount} base CCIP addresses`);
    if (additionalAddresses.length > 0) {
      this.logger.info(`✅ Plus ${additionalAddresses.length} additional custom addresses`);
    }
    this.logger.info(`✅ Total addresses: ${result.addresses.length}`);
    this.logger.info(`✅ Ready to be registered with setPool`);

    this.logger.info("");
    this.logger.info("📋 NEXT STEPS");
    this.logger.info("===================================================");
    this.logger.info(`1. Ensure you are the administrator for token ${tokenMint.toString()}`);
    this.logger.info(`2. Register this ALT with the token using setPool:`);
    this.logger.info(`   yarn svm:admin:set-pool \\\\`);
    this.logger.info(`     --token-mint ${tokenMint.toString()} \\\\`);
    this.logger.info(`     --lookup-table ${result.lookupTableAddress.toString()} \\\\`);
    this.logger.info(`     --writable-indices 3,4,7`);
    this.logger.info(`3. The token will then be ready for CCIP cross-chain operations`);
  }
}

// Create and run the command
const command = new CreateAltCommand();
command.run().catch((error) => {
  process.exit(1);
});