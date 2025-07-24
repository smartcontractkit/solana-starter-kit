/**
 * Token Admin Registry Set Pool Script (CLI Framework Version)
 *
 * This script registers an Address Lookup Table (ALT) with a token's admin registry,
 * enabling the token for CCIP cross-chain operations. Only the token administrator
 * can execute this operation.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for set pool operations
 */
const SET_POOL_CONFIG = {
  minSolRequired: 0.01,
  minAltAddresses: 7,
  defaultLogLevel: LogLevel.INFO,
  commonWritableIndices: [3, 4, 7], // pool_config, pool_token_account, token_mint
};

/**
 * Options specific to the set-pool command
 */
interface SetPoolOptions extends BaseCommandOptions {
  tokenMint: string;
  lookupTable: string;
  writableIndices: string;
}

/**
 * Token Admin Registry Set Pool Command
 */
class SetPoolCommand extends CCIPCommand<SetPoolOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "set-pool",
      description: "🏊 CCIP Token Admin Registry Pool Setter\\n\\nRegisters an Address Lookup Table (ALT) with a token's admin registry, enabling the token for CCIP cross-chain operations. Only the token administrator can execute this operation.",
      examples: [
        "# Set pool with typical writable indices for burn-mint tokens (most common case)",
        "yarn svm:admin:set-pool --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T --writable-indices 3,4,7",
        "",
        "# With debug logging",
        "yarn svm:admin:set-pool --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T --writable-indices 3,4,7 --log-level DEBUG"
      ],
      notes: [
        "Only the token administrator can set the pool",
        "The ALT must be created first using 'yarn svm:admin:create-alt'",
        `Writable indices are typically [${SET_POOL_CONFIG.commonWritableIndices.join(", ")}] for burn-mint tokens (pool_config, pool_token_account, token_mint)`,
        "Pool registration requires SOL for transaction fees",
        "This enables the token for CCIP cross-chain operations",
        "Use 'yarn svm:admin:propose-administrator' and 'yarn svm:admin:accept-admin-role' to become administrator",
        "Verify registration with token admin registry query tools",
        `Minimum ${SET_POOL_CONFIG.minSolRequired} SOL required for transaction fees`
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
        name: "lookup-table",
        required: true,
        type: "string",
        description: "Address Lookup Table address (from create-alt script)",
        example: "8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T"
      },
      {
        name: "writable-indices",
        required: true,
        type: "string",
        description: `Comma-separated writable indices (e.g., "${SET_POOL_CONFIG.commonWritableIndices.join(",")}" for burn-mint)`,
        example: "3,4,7"
      }
    ];
  }

  /**
   * Validate set pool configuration
   */
  private validateConfig(): { tokenMint: PublicKey; lookupTableAddress: PublicKey; writableIndices: number[] } {
    const errors: string[] = [];

    // Validate token mint address
    let tokenMint: PublicKey;
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch {
      errors.push("Invalid token mint address format");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    // Validate lookup table address
    let lookupTableAddress: PublicKey;
    try {
      lookupTableAddress = new PublicKey(this.options.lookupTable);
    } catch {
      errors.push("Invalid lookup table address format");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    // Parse and validate writable indices
    let writableIndices: number[];
    try {
      writableIndices = this.options.writableIndices
        .split(",")
        .map((index) => {
          const num = Number(index.trim());
          if (isNaN(num)) {
            throw new Error(`Invalid writable index: ${index}`);
          }
          return num;
        });

      if (writableIndices.length === 0) {
        errors.push("At least one writable index must be provided");
      }
    } catch (error) {
      errors.push("Invalid writable indices format. Use comma-separated numbers (e.g., '3,4,7' for burn-mint tokens)");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`
      );
    }

    return { tokenMint, lookupTableAddress, writableIndices };
  }

  /**
   * Check token admin registry status and permissions
   */
  private async checkTokenAdminRegistry(
    tokenMint: PublicKey,
    walletPublicKey: PublicKey,
    lookupTableAddress: PublicKey,
    tokenRegistryClient: any
  ): Promise<any> {
    this.logger.info("Checking current token admin registry...");
    this.logger.debug(`Checking registry for mint: ${tokenMint.toString()}`);

    try {
      const currentRegistry = await tokenRegistryClient.getTokenAdminRegistry(tokenMint);

      if (!currentRegistry) {
        throw new Error(
          "No token admin registry found for this token\\n" +
          "You must first propose and accept an administrator for this token\\n" +
          `Use: yarn svm:admin:propose-administrator --token-mint ${tokenMint.toString()}`
        );
      }

      this.logger.info(`Current administrator: ${currentRegistry.administrator.toString()}`);
      this.logger.info(`Current pending administrator: ${currentRegistry.pendingAdministrator.toString()}`);
      this.logger.info(`Current lookup table: ${currentRegistry.lookupTable.toString()}`);

      // Check if signer is the administrator
      if (!currentRegistry.administrator.equals(walletPublicKey)) {
        throw new Error(
          `Signer is not the administrator of this token\\n` +
          `Required: ${currentRegistry.administrator.toString()}\\n` +
          `Provided: ${walletPublicKey.toString()}\\n` +
          `Only the token administrator can set the pool`
        );
      }

      // Check if lookup table is already set to the same value
      if (currentRegistry.lookupTable.equals(lookupTableAddress)) {
        this.logger.info("✅ Lookup table is already set to the specified address");
        this.logger.info("No changes needed");
        return null; // Signal that no operation is needed
      }

      this.logger.debug("Current registry details:", {
        administrator: currentRegistry.administrator.toString(),
        pendingAdministrator: currentRegistry.pendingAdministrator.toString(),
        lookupTable: currentRegistry.lookupTable.toString(),
        mint: currentRegistry.mint.toString(),
      });

      return currentRegistry;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Configuration validation failed")) {
        throw error;
      }
      throw new Error(
        `Failed to fetch token admin registry: ${error instanceof Error ? error.message : String(error)}\\n` +
        `Ensure the token has an admin registry before setting the pool`
      );
    }
  }

  /**
   * Verify the lookup table exists and is valid
   */
  private async verifyLookupTable(lookupTableAddress: PublicKey, config: any): Promise<void> {
    this.logger.info("Verifying lookup table exists...");
    this.logger.debug(`Checking ALT at address: ${lookupTableAddress.toString()}`);

    try {
      const { value: lookupTableAccount } = await config.connection.getAddressLookupTable(lookupTableAddress);

      if (!lookupTableAccount) {
        throw new Error(
          `Lookup table not found: ${lookupTableAddress.toString()}\\n` +
          `Create the lookup table first using: yarn svm:admin:create-alt`
        );
      }

      const addressCount = lookupTableAccount.state.addresses.length;
      this.logger.info(`Lookup table verified with ${addressCount} addresses`);

      if (addressCount < SET_POOL_CONFIG.minAltAddresses) {
        this.logger.warn(
          `Lookup table has only ${addressCount} addresses (expected at least ${SET_POOL_CONFIG.minAltAddresses} for CCIP operations)`
        );
        this.logger.info("Ensure the lookup table was created with create-alt script");
      }

      this.logger.debug("Lookup table details:", {
        address: lookupTableAddress.toString(),
        addressCount: addressCount,
        authority: lookupTableAccount.state.authority?.toString() || "None",
        lastExtendedSlot: lookupTableAccount.state.lastExtendedSlot,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Configuration validation failed")) {
        throw error;
      }
      throw new Error(
        `Failed to verify lookup table: ${error instanceof Error ? error.message : String(error)}\\n` +
        `Ensure the lookup table address is correct and exists`
      );
    }
  }

  /**
   * Verify pool registration was successful
   */
  private async verifyPoolRegistration(
    tokenMint: PublicKey,
    lookupTableAddress: PublicKey,
    writableIndices: number[],
    tokenRegistryClient: any
  ): Promise<void> {
    this.logger.info("Verifying pool registration...");
    this.logger.debug("Attempting to fetch updated registry to verify pool...");

    try {
      const updatedRegistry = await tokenRegistryClient.getTokenAdminRegistry(tokenMint);

      if (!updatedRegistry) {
        this.logger.warn(
          "Pool registration succeeded but registry not found during verification\\n" +
          "This may be due to network delays - the registration should be recorded shortly"
        );
        return;
      }

      const currentLookupTable = updatedRegistry.lookupTable.toString();

      if (updatedRegistry.lookupTable.equals(lookupTableAddress)) {
        this.logger.info("✅ Pool registration verified successfully!");
        this.logger.info(`Registered lookup table: ${currentLookupTable}`);
        this.logger.info(`Writable indices: [${writableIndices.join(", ")}]`);

        this.logger.debug("Pool verification details:", {
          administrator: updatedRegistry.administrator.toString(),
          lookupTable: currentLookupTable,
          registeredLookupTable: lookupTableAddress.toString(),
          mint: updatedRegistry.mint.toString(),
        });
      } else {
        this.logger.warn(
          "Pool registration completed but verification shows different lookup table\\n" +
          `Expected: ${lookupTableAddress.toString()}\\n` +
          `Actual: ${currentLookupTable}`
        );
      }

      this.logger.trace("Complete verification info:", updatedRegistry);
    } catch (error) {
      this.logger.warn(
        `Pool registration succeeded but verification failed: ${error instanceof Error ? error.message : String(error)}\\n` +
        `This may be due to network delays - the registration should be recorded shortly`
      );
      this.logger.debug("Verification error details:", error);
    }
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Token Admin Registry Set Pool");
    this.logger.info("=============================================");

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
    this.logger.info("=============================================");
    const balance = await config.connection.getBalance(walletPublicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < SET_POOL_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${SET_POOL_CONFIG.minSolRequired} SOL for transaction fees. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration and parse parameters
    const { tokenMint, lookupTableAddress, writableIndices } = this.validateConfig();

    this.logger.info("");
    this.logger.info("⚙️  POOL CONFIGURATION");
    this.logger.info("=============================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Lookup Table: ${lookupTableAddress.toString()}`);
    this.logger.info(`Writable Indices: [${writableIndices.join(", ")}]`);

    this.logger.debug("");
    this.logger.debug("🔍 CONFIGURATION DETAILS");
    this.logger.debug("=============================================");
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

    // Check token admin registry status and permissions
    this.logger.info("");
    this.logger.info("🔍 REGISTRY VERIFICATION");
    this.logger.info("=============================================");
    const currentRegistry = await this.checkTokenAdminRegistry(
      tokenMint,
      walletPublicKey,
      lookupTableAddress,
      tokenRegistryClient
    );

    // If lookup table is already set correctly, we're done
    if (currentRegistry === null) {
      return;
    }

    // Verify the lookup table exists and is valid
    this.logger.info("");
    this.logger.info("🔍 LOOKUP TABLE VERIFICATION");
    this.logger.info("=============================================");
    await this.verifyLookupTable(lookupTableAddress, config);

    // Set the pool (register ALT with token)
    this.logger.info("");
    this.logger.info("🏊 SETTING POOL");
    this.logger.info("=============================================");
    this.logger.info("Setting pool (registering ALT with token)...");
    const signature = await tokenRegistryClient.setPool({
      tokenMint,
      lookupTable: lookupTableAddress,
      writableIndices,
    });

    // Display results
    this.logger.info("");
    this.logger.info("✅ POOL SET SUCCESSFULLY");
    this.logger.info("=============================================");
    this.logger.info(`Transaction Signature: ${signature}`);

    // Display explorer URL
    this.logger.info("");
    this.logger.info("🔍 EXPLORER URLS");
    this.logger.info("=============================================");
    this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

    // Verify the pool was set
    this.logger.info("");
    this.logger.info("🔍 FINAL VERIFICATION");
    this.logger.info("=============================================");
    await this.verifyPoolRegistration(tokenMint, lookupTableAddress, writableIndices, tokenRegistryClient);

    this.logger.info("");
    this.logger.info("🎉 Pool Registration Complete!");
    this.logger.info(`✅ Token: ${tokenMint.toString()}`);
    this.logger.info(`✅ ALT: ${lookupTableAddress.toString()}`);
    this.logger.info(`✅ Ready for CCIP cross-chain operations`);

    this.logger.info("");
    this.logger.info("📋 NEXT STEPS");
    this.logger.info("=============================================");
    this.logger.info("• The token is now enabled for CCIP transfers");
    this.logger.info("• Test cross-chain operations using the CCIP router scripts");
    this.logger.info("• Use yarn ccip:send to send tokens cross-chain");
    this.logger.info("• Monitor transactions on CCIP Explorer");
  }
}

// Create and run the command
const command = new SetPoolCommand();
command.run().catch((error) => {
  process.exit(1);
});