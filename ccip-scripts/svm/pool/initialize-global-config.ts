/**
 * Global Config Initialization Script (CLI Framework Version)
 *
 * This script initializes the global configuration for a burn-mint token pool program.
 * This MUST be run once per program deployment before any individual pools can be created.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for global config initialization
 */
const GLOBAL_CONFIG_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the initialize-global-config command
 */
interface InitializeGlobalConfigOptions extends BaseCommandOptions {
  burnMintPoolProgram: string;
}

/**
 * Global Config Initialization Command
 */
class InitializeGlobalConfigCommand extends CCIPCommand<InitializeGlobalConfigOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "initialize-global-config",
      description: "🌍 Global Config Initialization\n\nInitializes the global configuration for a burn-mint token pool program. This MUST be run once per program deployment before any individual pools can be created.",
      examples: [
        "# Initialize global config with burn-mint pool program",
        "yarn svm:pool:init-global-config --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh",
        "",
        "# Initialize with debug logging",
        "yarn svm:pool:init-global-config --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --log-level DEBUG"
      ],
      notes: [
        "⚠️ This must be run by the program upgrade authority",
        "This only needs to be run ONCE per program deployment",
        `Minimum ${GLOBAL_CONFIG_CONFIG.minSolRequired} SOL required for transaction fees`,
        "Creates the program-wide configuration PDA",
        "After this succeeds, individual pools can be initialized with initialize-pool.ts",
        "Global config initialization is a prerequisite for all pool operations",
        "If already initialized, the script will fail with an appropriate message"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("🌍 CCIP Token Pool Global Config Initialization");
    this.logger.info("==========================================");
    this.logger.warn("⚠️  This must be run by the program upgrade authority ONCE per deployment");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (must be upgrade authority)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);
    this.logger.warn("🔑 Ensure this wallet is the program upgrade authority for the token pool program");

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("==========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < GLOBAL_CONFIG_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${GLOBAL_CONFIG_CONFIG.minSolRequired} SOL for transaction fees.\n` +
        `Current balance: ${solBalance.toFixed(9)} SOL\n\n` +
        `Request airdrop with:\n` +
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
    }

    // Parse and validate burn-mint pool program ID
    let burnMintPoolProgramId: PublicKey;
    try {
      burnMintPoolProgramId = new PublicKey(this.options.burnMintPoolProgram);
    } catch {
      throw new Error(`Invalid burn-mint pool program ID: ${this.options.burnMintPoolProgram}`);
    }

    // Display program information
    this.logger.info("");
    this.logger.info("📋 PROGRAM INFORMATION");
    this.logger.info("==========================================");
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Router Program: ${config.routerProgramId.toString()}`);
    this.logger.info(`RMN Remote Program: ${config.rmnRemoteProgramId.toString()}`);

    this.logger.debug("Global config initialization details:");
    this.logger.debug(`  Network: ${config.id}`);
    this.logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`  Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`  Authority: ${walletKeypair.publicKey.toString()}`);
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

      // Initialize the global config
      this.logger.info("");
      this.logger.info("🔧 INITIALIZING GLOBAL CONFIG");
      this.logger.info("==========================================");
      this.logger.info("Creating the program-wide configuration PDA...");
      
      this.logger.debug("Calling SDK initializeGlobalConfig method...");
      this.logger.debug(`Transaction options: skipPreflight=${this.options.skipPreflight}`);

      const signature = await tokenPoolClient.initializeGlobalConfig({
        txOptions: {
          skipPreflight: this.options.skipPreflight,
        },
      });

      this.logger.debug(`Transaction completed with signature: ${signature}`);

      // Display results
      this.logger.info("");
      this.logger.info("✅ GLOBAL CONFIG INITIALIZED SUCCESSFULLY");
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
      this.logger.info("1. Deploy your token mint (if not already done)");
      this.logger.info("2. Enable self-served pools:");
      this.logger.info("   yarn svm:pool:update-self-served-allowed --self-served-allowed true --burn-mint-pool-program <PROGRAM>");
      this.logger.info("3. Initialize individual token pools:");
      this.logger.info("   yarn svm:pool:initialize-pool");

      this.logger.info("");
      this.logger.info("🎉 Global Configuration Complete!");
      this.logger.info("✅ Global configuration is now ready");
      this.logger.info("✅ You can now initialize individual token pools");
      
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized")) {
          this.logger.error("");
          this.logger.error("🚨 AUTHORIZATION ERROR");
          this.logger.error("==========================================");
          this.logger.error("The wallet is not the program upgrade authority for this program.");
          this.logger.error("Only the program upgrade authority can initialize global config.");
          throw error;
        } else if (error.message.includes("already in use")) {
          this.logger.warn("");
          this.logger.warn("⚠️  ALREADY INITIALIZED");
          this.logger.warn("==========================================");
          this.logger.warn("Global config may already be initialized.");
          this.logger.warn("This script only needs to be run once per deployment.");
          throw error;
        }
      }

      this.logger.error(
        `❌ Failed to initialize global config: ${error instanceof Error ? error.message : String(error)}`
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
const command = new InitializeGlobalConfigCommand();
command.run().catch((error) => {
  process.exit(1);
});