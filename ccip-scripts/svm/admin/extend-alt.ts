/**
 * CCIP Address Lookup Table (ALT) Extension Script (CLI Framework Version)
 *
 * This script extends an existing Address Lookup Table by appending new addresses.
 * This is useful when you need to add additional accounts to an ALT after it has
 * been created, allowing for more flexible transaction composition.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { createErrorEnhancer } from "../../../ccip-lib/svm/utils/errors";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for ALT extension operations
 */
const ALT_EXTENSION_CONFIG = {
  minSolRequired: 0.01,
  maxAddressesPerTx: 30,
  maxAltCapacity: 256,
  batchDelayMs: 2000,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the extend-alt command
 */
interface ExtendAltOptions extends BaseCommandOptions {
  lookupTableAddress: string;
  addresses: string;
}

/**
 * CCIP Address Lookup Table Extension Command
 */
class ExtendAltCommand extends CCIPCommand<ExtendAltOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "extend-alt",
      description: "🔧 CCIP Address Lookup Table Extender\\n\\nExtends an existing Address Lookup Table by appending new addresses. This allows for more flexible transaction composition after initial ALT creation.",
      examples: [
        "# Add single address to ALT",
        "yarn svm:admin:extend-alt --lookup-table-address Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M --addresses \"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU\"",
        "",
        "# Add multiple addresses to ALT",
        "yarn svm:admin:extend-alt --lookup-table-address Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M --addresses \"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA\"",
        "",
        "# With debug logging",
        "yarn svm:admin:extend-alt --lookup-table-address Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M --addresses \"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU\" --log-level DEBUG"
      ],
      notes: [
        "ALT extension requires SOL for transaction fees",
        "You must be the authority of the ALT you want to extend",
        `ALTs have a maximum capacity of ${ALT_EXTENSION_CONFIG.maxAltCapacity} addresses`,
        `Large address lists are automatically batched (~${ALT_EXTENSION_CONFIG.maxAddressesPerTx} addresses per tx)`,
        "Extended ALTs need 1 slot to \"warm up\" before new addresses can be used",
        "New addresses are appended to the end of the existing address list",
        "Use comma-separated format for multiple addresses (no spaces around commas)",
        "ALT must not be frozen to allow extensions",
        `Minimum ${ALT_EXTENSION_CONFIG.minSolRequired} SOL required for transaction fees`
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "lookup-table-address",
        required: true,
        type: "string",
        description: "Address of the existing ALT to extend",
        example: "Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M"
      },
      {
        name: "addresses",
        required: true,
        type: "string",
        description: "Comma-separated list of addresses to add to the ALT",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
      }
    ];
  }

  /**
   * Validate ALT extension configuration
   */
  private validateConfig(): { lookupTableAddress: PublicKey; addressList: PublicKey[] } {
    const errors: string[] = [];

    // Validate lookup table address
    let lookupTableAddress: PublicKey;
    try {
      lookupTableAddress = new PublicKey(this.options.lookupTableAddress);
    } catch {
      errors.push("Invalid lookup table address format");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    // Parse and validate addresses
    let addressList: PublicKey[] = [];
    try {
      const addressStrings = this.options.addresses
        .split(",")
        .map((addr) => addr.trim())
        .filter((addr) => addr.length > 0);

      if (addressStrings.length === 0) {
        errors.push("At least one address must be provided");
      }

      addressList = addressStrings.map((addr) => {
        try {
          return new PublicKey(addr);
        } catch {
          errors.push(`Invalid address format: ${addr}`);
          throw new Error("Invalid address format");
        }
      });
    } catch {
      errors.push("Failed to parse addresses");
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`
      );
    }

    return { lookupTableAddress, addressList };
  }

  /**
   * Verify ALT exists and check authority
   */
  private async verifyAltAccess(
    lookupTableAddress: PublicKey,
    walletPublicKey: PublicKey,
    config: any
  ): Promise<{ currentAddressCount: number; authority: PublicKey }> {
    this.logger.info("Verifying ALT exists and checking authority...");
    
    const altAccount = await config.connection.getAddressLookupTable(lookupTableAddress);

    if (!altAccount.value) {
      throw new Error(`Address Lookup Table not found: ${lookupTableAddress.toString()}`);
    }

    const currentAuthority = altAccount.value.state.authority;
    if (!currentAuthority) {
      throw new Error(`ALT has no authority (frozen): ${lookupTableAddress.toString()}`);
    }

    if (!currentAuthority.equals(walletPublicKey)) {
      throw new Error(
        `You are not the authority of this ALT. Authority: ${currentAuthority.toString()}, Your key: ${walletPublicKey.toString()}`
      );
    }

    const currentAddressCount = altAccount.value.state.addresses.length;

    this.logger.info(`✅ ALT verified. Current authority: ${currentAuthority.toString()}`);
    this.logger.info(`✅ Current ALT contains ${currentAddressCount} addresses`);

    return { currentAddressCount, authority: currentAuthority };
  }

  /**
   * Check ALT capacity constraints
   */
  private checkCapacity(currentAddressCount: number, newAddressCount: number): void {
    const totalAfterExtend = currentAddressCount + newAddressCount;

    if (totalAfterExtend > ALT_EXTENSION_CONFIG.maxAltCapacity) {
      throw new Error(
        `ALT capacity exceeded. Current: ${currentAddressCount}, Adding: ${newAddressCount}, Total would be: ${totalAfterExtend}, Max: ${ALT_EXTENSION_CONFIG.maxAltCapacity}`
      );
    }

    this.logger.info(
      `ALT capacity check passed: ${currentAddressCount} + ${newAddressCount} = ${totalAfterExtend} / ${ALT_EXTENSION_CONFIG.maxAltCapacity}`
    );
  }

  /**
   * Process address batches for extension
   */
  private async processAddressBatches(
    lookupTableAddress: PublicKey,
    addressList: PublicKey[],
    currentAddressCount: number,
    tokenRegistryClient: any,
    config: any
  ): Promise<string[]> {
    // Create batches
    const addressBatches: PublicKey[][] = [];
    for (let i = 0; i < addressList.length; i += ALT_EXTENSION_CONFIG.maxAddressesPerTx) {
      addressBatches.push(addressList.slice(i, i + ALT_EXTENSION_CONFIG.maxAddressesPerTx));
    }

    this.logger.info(`Will process ${addressBatches.length} batch(es) of addresses`);

    // Process each batch
    const signatures: string[] = [];
    const errorContext = {
      operation: "extendALT",
      lookupTableAddress: lookupTableAddress.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    for (let batchIndex = 0; batchIndex < addressBatches.length; batchIndex++) {
      const batch = addressBatches[batchIndex];
      this.logger.info(
        `Processing batch ${batchIndex + 1}/${addressBatches.length} with ${batch.length} addresses...`
      );

      try {
        const result = await tokenRegistryClient.extendTokenPoolLookupTable({
          lookupTableAddress,
          newAddresses: batch,
        });

        signatures.push(result.signature);
        this.logger.info(`Batch ${batchIndex + 1} completed successfully! Transaction: ${result.signature}`);
        this.logger.info(`Explorer: ${getExplorerUrl(config.id, result.signature)}`);

        // Wait between batches to avoid overwhelming the network
        if (batchIndex < addressBatches.length - 1) {
          this.logger.info(`Waiting ${ALT_EXTENSION_CONFIG.batchDelayMs / 1000} seconds before next batch...`);
          await new Promise((resolve) => setTimeout(resolve, ALT_EXTENSION_CONFIG.batchDelayMs));
        }
      } catch (error) {
        this.logger.error(`Batch ${batchIndex + 1} failed:`, error);
        throw enhanceError(error, {
          ...errorContext,
          batch: (batchIndex + 1).toString(),
          batchSize: batch.length.toString(),
        });
      }
    }

    return signatures;
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Address Lookup Table Extension");
    this.logger.info("===============================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    const walletPublicKey = walletKeypair.publicKey;
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletPublicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("===============================================");
    const balance = await config.connection.getBalance(walletPublicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < ALT_EXTENSION_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${ALT_EXTENSION_CONFIG.minSolRequired} SOL for transaction fees. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration and parse addresses
    const { lookupTableAddress, addressList } = this.validateConfig();

    this.logger.info("");
    this.logger.info("⚙️  EXTENSION CONFIGURATION");
    this.logger.info("===============================================");
    this.logger.info(`ALT Address: ${lookupTableAddress.toString()}`);
    this.logger.info(`Adding ${addressList.length} addresses to ALT`);

    this.logger.debug("");
    this.logger.debug("🔍 CONFIGURATION DETAILS");
    this.logger.debug("===============================================");
    this.logger.debug(`Network: ${config.id}`);
    this.logger.debug(`Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`Skip preflight: ${this.options.skipPreflight}`);
    this.logger.debug(`Log level: ${this.options.logLevel}`);

    // Create token registry client
    const tokenRegistryClient = TokenRegistryClient.create(
      config.connection,
      walletKeypair,
      config.routerProgramId.toString(),
      {},
      { logLevel: this.options.logLevel }
    );

    // Verify ALT access and get current state
    this.logger.info("");
    this.logger.info("🔍 ALT VERIFICATION");
    this.logger.info("===============================================");
    const { currentAddressCount } = await this.verifyAltAccess(
      lookupTableAddress,
      walletPublicKey,
      config
    );

    // Check capacity constraints
    this.checkCapacity(currentAddressCount, addressList.length);

    // Log the addresses being added
    this.logger.info("");
    this.logger.info("📋 ADDRESSES TO ADD");
    this.logger.info("===============================================");
    addressList.forEach((addr, index) => {
      this.logger.info(`[${currentAddressCount + index}]: ${addr.toString()}`);
    });

    // Process the extension in batches
    this.logger.info("");
    this.logger.info("🏗️  EXTENDING ADDRESS LOOKUP TABLE");
    this.logger.info("===============================================");
    const signatures = await this.processAddressBatches(
      lookupTableAddress,
      addressList,
      currentAddressCount,
      tokenRegistryClient,
      config
    );

    // Final verification
    this.logger.info("");
    this.logger.info("🔍 FINAL VERIFICATION");
    this.logger.info("===============================================");
    const updatedAltAccount = await config.connection.getAddressLookupTable(lookupTableAddress);
    const totalAfterExtend = currentAddressCount + addressList.length;

    if (updatedAltAccount.value) {
      const finalAddressCount = updatedAltAccount.value.state.addresses.length;
      this.logger.info(`✅ ALT extension verified! Final address count: ${finalAddressCount}`);

      if (finalAddressCount === totalAfterExtend) {
        this.logger.info("✅ All addresses added successfully!");
      } else {
        this.logger.warn(
          `⚠️  Address count mismatch. Expected: ${totalAfterExtend}, Actual: ${finalAddressCount}`
        );
      }
    }

    // Display results
    this.logger.info("");
    this.logger.info("✅ ALT EXTENSION COMPLETED");
    this.logger.info("===============================================");
    this.logger.info(`ALT Address: ${lookupTableAddress.toString()}`);
    this.logger.info(`Added ${addressList.length} new addresses`);
    this.logger.info(`Processed in ${signatures.length} transaction(s)`);

    // Display explorer URLs
    this.logger.info("");
    this.logger.info("🔍 EXPLORER URLS");
    this.logger.info("===============================================");
    signatures.forEach((sig, index) => {
      this.logger.info(`Batch ${index + 1}: ${getExplorerUrl(config.id, sig)}`);
    });

    this.logger.info("");
    this.logger.info("🎉 ALT Extension Complete!");
    this.logger.info(`✅ ALT Address: ${lookupTableAddress.toString()}`);
    this.logger.info(`✅ Added ${addressList.length} new addresses`);
    this.logger.info(`✅ Processed in ${signatures.length} transaction(s)`);
    
    this.logger.info("");
    this.logger.info("ℹ️  Note: Extended ALTs need 1 slot to \"warm up\" before new addresses can be used");
  }
}

// Create and run the command
const command = new ExtendAltCommand();
command.run().catch((error) => {
  process.exit(1);
});