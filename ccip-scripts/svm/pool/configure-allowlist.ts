/**
 * Configure Allowlist Script (CLI Framework Version)
 *
 * This script manages the allowlist for a burn-mint token pool, allowing you to
 * add addresses and enable/disable allowlist checking for on-ramp operations.
 * The allowlist controls which addresses are permitted to receive tokens from cross-chain transfers.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for allowlist operations
 */
const ALLOWLIST_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
  maxAddressesPerTransaction: 10, // Reasonable limit to avoid transaction size issues
};

/**
 * Options specific to the configure-allowlist command
 */
interface ConfigureAllowlistOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
  addAddresses?: string;
  enabled: boolean;
}

/**
 * Configure Allowlist Command
 */
class ConfigureAllowlistCommand extends CCIPCommand<ConfigureAllowlistOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "configure-allowlist",
      description: "📋 Allowlist Configuration Manager\n\nManage the allowlist for a burn-mint token pool. The allowlist controls which addresses are permitted to receive tokens from cross-chain transfers (on-ramp operations). You can add addresses and enable/disable allowlist checking.",
      examples: [
        "# Add addresses to allowlist and enable checking",
        "yarn svm:pool:configure-allowlist --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --add-addresses \"8UJgxaiQx9LHvAYV3nFecLy83dLECKSTt9Y82MuJFSWH,9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM\" --enabled true",
        "",
        "# Add single address to allowlist",
        "yarn svm:pool:configure-allowlist --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --add-addresses \"8UJgxaiQx9LHvAYV3nFecLy83dLECKSTt9Y82MuJFSWH\" --enabled true",
        "",
        "# Disable allowlist checking (allow all addresses)",
        "yarn svm:pool:configure-allowlist --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --enabled false",
        "",
        "# Enable allowlist checking without adding new addresses",
        "yarn svm:pool:configure-allowlist --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --enabled true"
      ],
      notes: [
        `Minimum ${ALLOWLIST_CONFIG.minSolRequired} SOL required for transaction fees`,
        "The token pool must already exist",
        "Wallet must be the pool owner",
        "Allowlist affects on-ramp operations (tokens coming TO Solana from other chains)",
        "Multiple addresses can be separated by commas",
        `Maximum ${ALLOWLIST_CONFIG.maxAddressesPerTransaction} addresses per transaction`,
        "Addresses must be valid Solana public keys",
        "Setting enabled=false allows all addresses (disables allowlist checking)",
        "Setting enabled=true restricts transfers to allowlisted addresses only",
        "Use 'yarn svm:pool:get-info' to view current allowlist configuration"
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
        description: "Token mint address of existing pool",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      },
      {
        name: "add-addresses",
        required: false,
        type: "string",
        description: "Comma-separated Solana addresses to add to allowlist",
        example: "8UJgxaiQx9LHvAYV3nFecLy83dLECKSTt9Y82MuJFSWH,9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
      },
      {
        name: "enabled",
        required: true,
        type: "boolean",
        description: "Enable allowlist checking (true) or allow all addresses (false)",
        example: "true"
      }
    ];
  }

  /**
   * Parse and validate addresses
   */
  private parseAddresses(addressesString?: string): PublicKey[] {
    if (!addressesString || addressesString.trim() === "") {
      return [];
    }

    const addresses = addressesString
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    if (addresses.length > ALLOWLIST_CONFIG.maxAddressesPerTransaction) {
      throw new Error(
        `Too many addresses provided (${addresses.length}). ` +
        `Maximum ${ALLOWLIST_CONFIG.maxAddressesPerTransaction} addresses per transaction.`
      );
    }

    const publicKeys: PublicKey[] = [];
    const invalidAddresses: string[] = [];

    for (const addr of addresses) {
      try {
        publicKeys.push(new PublicKey(addr));
      } catch {
        invalidAddresses.push(addr);
      }
    }

    if (invalidAddresses.length > 0) {
      throw new Error(
        `Invalid Solana addresses found:\n${invalidAddresses.map(addr => `  - ${addr}`).join('\n')}\n\n` +
        `Please provide valid Solana public key addresses.`
      );
    }

    return publicKeys;
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(addresses: PublicKey[], enabled: boolean): void {
    if (enabled && addresses.length === 0) {
      this.logger.warn("⚠️  Warning: Enabling allowlist without adding any addresses.");
      this.logger.warn("   This will block ALL cross-chain transfers to this pool.");
      this.logger.warn("   Consider adding at least one address or setting --enabled false.");
    }

    if (!enabled && addresses.length > 0) {
      this.logger.warn("⚠️  Warning: Adding addresses while allowlist is disabled.");
      this.logger.warn("   Addresses will be added but allowlist checking will remain disabled.");
      this.logger.warn("   Set --enabled true to activate allowlist checking.");
    }
  }

  protected async execute(): Promise<void> {
    this.logger.info("📋 CCIP Allowlist Configuration Manager");
    this.logger.info("==========================================");

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
    this.logger.info("==========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < ALLOWLIST_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${ALLOWLIST_CONFIG.minSolRequired} SOL for transaction fees.\n` +
        `Current balance: ${solBalance.toFixed(9)} SOL\n\n` +
        `Request airdrop with:\n` +
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
    }

    // Parse and validate addresses
    let tokenMint: PublicKey;
    let burnMintPoolProgramId: PublicKey;
    
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch {
      throw new Error(`Invalid token mint address: ${this.options.tokenMint}`);
    }
    
    try {
      burnMintPoolProgramId = new PublicKey(this.options.burnMintPoolProgram);
    } catch {
      throw new Error(`Invalid burn-mint pool program ID: ${this.options.burnMintPoolProgram}`);
    }

    // Parse addresses to add
    const addressesToAdd = this.parseAddresses(this.options.addAddresses);

    // Validate configuration
    this.validateConfiguration(addressesToAdd, this.options.enabled);

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 ALLOWLIST CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Allowlist Enabled: ${this.options.enabled}`);
    this.logger.info(`Addresses to Add: ${addressesToAdd.length}`);
    
    if (addressesToAdd.length > 0) {
      this.logger.info("");
      this.logger.info("📝 ADDRESSES TO ADD:");
      addressesToAdd.forEach((addr, index) => {
        this.logger.info(`  ${index + 1}. ${addr.toString()}`);
      });
    }

    this.logger.debug("Configuration details:");
    this.logger.debug(`  Network: ${config.id}`);
    this.logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`  Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`  Skip preflight: ${this.options.skipPreflight}`);

    try {
      // Create token pool manager using SDK
      const tokenPoolManager = TokenPoolManager.create(
        config.connection,
        walletKeypair,
        {
          burnMint: burnMintPoolProgramId,
        },
        {
          ccipRouterProgramId: config.routerProgramId.toString(),
          feeQuoterProgramId: config.feeQuoterProgramId.toString(),
          rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
          linkTokenMint: config.linkTokenMint.toString(),
          receiverProgramId: config.receiverProgramId.toString(),
        },
        { logLevel: this.options.logLevel ?? LogLevel.INFO }
      );

      const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

      // Configure the allowlist
      this.logger.info("");
      this.logger.info("📋 CONFIGURING ALLOWLIST");
      this.logger.info("==========================================");
      this.logger.info("Updating allowlist configuration...");

      const signature = await tokenPoolClient.configureAllowlist(tokenMint, {
        add: addressesToAdd,
        enabled: this.options.enabled,
        txOptions: {
          skipPreflight: this.options.skipPreflight,
        },
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ ALLOWLIST CONFIGURED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("View updated configuration:");
      this.logger.info(`  yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`);

      this.logger.info("");
      this.logger.info("🎉 Allowlist Configuration Complete!");
      this.logger.info(`✅ Allowlist checking: ${this.options.enabled ? "Enabled" : "Disabled"}`);
      if (addressesToAdd.length > 0) {
        this.logger.info(`✅ Added ${addressesToAdd.length} address${addressesToAdd.length === 1 ? '' : 'es'} to allowlist`);
      }
      
      if (this.options.enabled) {
        this.logger.info("");
        this.logger.info("ℹ️  With allowlist enabled, only allowlisted addresses can receive tokens from cross-chain transfers.");
      } else {
        this.logger.info("");
        this.logger.info("ℹ️  With allowlist disabled, any address can receive tokens from cross-chain transfers.");
      }
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to configure allowlist: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new ConfigureAllowlistCommand();
command.run().catch((error) => {
  process.exit(1);
});