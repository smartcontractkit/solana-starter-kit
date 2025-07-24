/**
 * Token Pool Initialization Script (CLI Framework Version)
 *
 * This script initializes a burn-mint token pool for CCIP cross-chain token transfers.
 * It creates a State PDA (Program Derived Address) that stores the pool configuration.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager, TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { findBurnMintPoolConfigPDA } from "../../../ccip-lib/svm/utils/pdas/tokenpool";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for pool initialization operations
 */
const POOL_INIT_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the initialize-pool command
 */
interface InitializePoolOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
}

/**
 * Token Pool Initialization Command
 */
class InitializePoolCommand extends CCIPCommand<InitializePoolOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "initialize-pool",
      description: "🏊 CCIP Token Pool Initializer\\n\\nInitializes a burn-mint token pool for CCIP cross-chain token transfers. Creates a State PDA that stores the pool configuration.",
      examples: [
        "# Initialize a token pool",
        "yarn svm:pool:initialize --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh",
        "",
        "# With debug logging",
        "yarn svm:pool:initialize --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --log-level DEBUG"
      ],
      notes: [
        "The wallet will become the pool administrator",
        "Router and RMN Remote program IDs are retrieved from configuration",
        "Pool initialization requires SOL for transaction fees",
        "Creates a State PDA account that represents the pool configuration",
        `Minimum ${POOL_INIT_CONFIG.minSolRequired} SOL required for transaction fees`,
        "Pool must be initialized before other operations like registration or transfers"
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
        description: "Token mint address to create pool for",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      }
    ];
  }

  /**
   * Validate pool initialization configuration
   */
  private validateConfig(): { tokenMint: PublicKey; burnMintPoolProgramId: PublicKey } {
    const errors: string[] = [];

    // Validate token mint address
    let tokenMint: PublicKey;
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch {
      errors.push("Invalid token mint address format");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    // Validate burn-mint pool program ID
    let burnMintPoolProgramId: PublicKey;
    try {
      burnMintPoolProgramId = new PublicKey(this.options.burnMintPoolProgram);
    } catch {
      errors.push("Invalid burn-mint pool program ID format");
      throw new Error(`Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`);
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`
      );
    }

    return { tokenMint, burnMintPoolProgramId };
  }

  /**
   * Check if pool already exists
   */
  private async checkPoolExistence(
    tokenMint: PublicKey,
    burnMintPoolProgramId: PublicKey,
    config: any
  ): Promise<{ exists: boolean; statePDA: PublicKey; stateBump: number }> {
    this.logger.info("Checking if pool already exists...");
    
    const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
      tokenMint,
      burnMintPoolProgramId
    );
    this.logger.debug(`State PDA: ${statePDA.toString()} (bump: ${stateBump})`);

    const stateAccountInfo = await config.connection.getAccountInfo(statePDA);
    const poolExists = stateAccountInfo !== null;
    this.logger.debug(`Pool exists: ${poolExists}`);

    if (poolExists) {
      this.logger.warn("Pool already exists for this token mint");
      this.logger.info(`Existing pool State PDA: ${statePDA.toString()}`);
      this.logger.info("Use 'yarn svm:pool:get-info' to view pool details");
      this.logger.debug(
        `To view details: yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
    }

    return { exists: poolExists, statePDA, stateBump };
  }

  /**
   * Verify pool initialization was successful
   */
  private async verifyPoolInitialization(
    tokenMint: PublicKey,
    burnMintPoolProgramId: PublicKey,
    statePDA: PublicKey,
    stateBump: number,
    tokenPoolClient: any
  ): Promise<void> {
    this.logger.info("Verifying pool initialization...");
    this.logger.debug("Attempting to fetch pool info to verify initialization...");
    
    try {
      const poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
      this.logger.info("✅ Pool initialization verified successfully!");
      this.logger.info(`✅ State PDA confirmed active: ${statePDA.toString()}`);
      
      this.logger.debug("Pool verification details:", {
        statePDA: statePDA.toString(),
        stateBump: stateBump,
        poolType: poolInfo.poolType,
        owner: poolInfo.config.config.owner.toString(),
        version: poolInfo.config.version,
        decimals: poolInfo.config.config.decimals,
        router: poolInfo.config.config.router.toString(),
      });
      this.logger.trace("Complete verification info:", poolInfo);

      this.logger.info("");
      this.logger.info("🎯 POOL CREATION SUMMARY");
      this.logger.info("===============================================");
      this.logger.info(`Token Mint: ${tokenMint.toString()}`);
      this.logger.info(`State PDA: ${statePDA.toString()}`);
      this.logger.info(`Owner: ${poolInfo.config.config.owner.toString()}`);
      this.logger.info(`Program: ${burnMintPoolProgramId.toString()}`);

      this.logger.info("");
      this.logger.info("💡 NEXT STEPS");
      this.logger.info("===============================================");
      this.logger.info(`View details: yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`);
      
    } catch (error) {
      this.logger.warn(
        `Pool transaction succeeded but verification failed: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.debug("Verification error details:", error);
      
      this.logger.info("");
      this.logger.info("🎯 POOL CREATION SUMMARY (UNVERIFIED)");
      this.logger.info("===============================================");
      this.logger.info(`Token Mint: ${tokenMint.toString()}`);
      this.logger.info(`State PDA: ${statePDA.toString()}`);
      this.logger.info(`Program: ${burnMintPoolProgramId.toString()}`);
      this.logger.info("");
      this.logger.info("This may be due to network delays - the pool should exist shortly");
    }
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Token Pool Initialization");
    this.logger.info("===========================================");

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
    this.logger.info("===========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < POOL_INIT_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${POOL_INIT_CONFIG.minSolRequired} SOL for transaction fees. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration and parse parameters
    const { tokenMint, burnMintPoolProgramId } = this.validateConfig();

    this.logger.info("");
    this.logger.info("⚙️  POOL CONFIGURATION");
    this.logger.info("===========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Router Program: ${config.routerProgramId.toString()}`);
    this.logger.info(`RMN Remote Program: ${config.rmnRemoteProgramId.toString()}`);

    this.logger.debug("");
    this.logger.debug("🔍 CONFIGURATION DETAILS");
    this.logger.debug("===========================================");
    this.logger.debug(`Network: ${config.id}`);
    this.logger.debug(`Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`Skip preflight: ${this.options.skipPreflight}`);
    this.logger.debug(`Log level: ${this.options.logLevel}`);

    // Create token pool manager using SDK
    const programIds = { burnMint: burnMintPoolProgramId };
    const tokenPoolManager = TokenPoolManager.create(
      config.connection,
      walletKeypair,
      programIds,
      {
        ccipRouterProgramId: config.routerProgramId.toString(),
        feeQuoterProgramId: config.feeQuoterProgramId.toString(),
        rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
        linkTokenMint: config.linkTokenMint.toString(),
        receiverProgramId: config.receiverProgramId.toString(),
      },
      { logLevel: this.options.logLevel ?? POOL_INIT_CONFIG.defaultLogLevel }
    );

    const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

    // Check if pool already exists
    this.logger.info("");
    this.logger.info("🔍 POOL EXISTENCE CHECK");
    this.logger.info("===========================================");
    const { exists: poolExists, statePDA, stateBump } = await this.checkPoolExistence(
      tokenMint,
      burnMintPoolProgramId,
      config
    );

    if (poolExists) {
      return;
    }

    // Initialize the pool
    this.logger.info("");
    this.logger.info("🏗️  INITIALIZING POOL");
    this.logger.info("===========================================");
    this.logger.info("Initializing token pool...");
    this.logger.debug(`Creating State PDA at: ${statePDA.toString()}`);
    
    const signature = await tokenPoolClient.initializePool(tokenMint, {
      txOptions: {
        skipPreflight: this.options.skipPreflight,
      },
    });

    // Display results
    this.logger.info("");
    this.logger.info("✅ POOL INITIALIZED SUCCESSFULLY");
    this.logger.info("===========================================");
    this.logger.info(`Transaction Signature: ${signature}`);
    this.logger.info(`📍 Pool State PDA: ${statePDA.toString()}`);
    this.logger.debug(`State PDA bump: ${stateBump}`);

    // Display explorer URL
    this.logger.info("");
    this.logger.info("🔍 EXPLORER URLS");
    this.logger.info("===========================================");
    this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

    // Verify initialization
    this.logger.info("");
    this.logger.info("🔍 VERIFICATION");
    this.logger.info("===========================================");
    await this.verifyPoolInitialization(
      tokenMint,
      burnMintPoolProgramId,
      statePDA,
      stateBump,
      tokenPoolClient
    );
  }
}

// Create and run the command
const command = new InitializePoolCommand();
command.run().catch((error) => {
  process.exit(1);
});