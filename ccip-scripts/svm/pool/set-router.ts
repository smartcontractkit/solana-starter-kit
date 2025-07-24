/**
 * Token Pool Set Router Script (CLI Framework Version)
 *
 * This script sets the configured CCIP router for an existing burn-mint token pool.
 * Only the pool owner can execute this operation.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for set router operations
 */
const SET_ROUTER_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the set-router command
 */
interface SetRouterOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
}

/**
 * Set Router Command
 */
class SetRouterCommand extends CCIPCommand<SetRouterOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "set-router",
      description: "🔄 Token Pool Router Setter\n\nSets the configured CCIP router for an existing burn-mint token pool. Only the pool owner can execute this operation. The router address is automatically loaded from the configuration, ensuring consistency with other CCIP scripts.",
      examples: [
        "# Set router for token pool",
        "yarn svm:pool:set-router --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh",
        "",
        "# Set router with debug logging",
        "yarn svm:pool:set-router --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --log-level DEBUG"
      ],
      notes: [
        "Only the pool owner can set a router",
        `Minimum ${SET_ROUTER_CONFIG.minSolRequired} SOL required for transaction fees`,
        "The pool must already exist before setting a router",
        "Router address is automatically loaded from CCIP configuration",
        "Router change requires SOL for transaction fees",
        "Use 'yarn svm:pool:get-info' to view current pool configuration",
        "Verifies the router update after transaction completion",
        "No action needed if router is already set correctly"
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
        description: "Token mint address of the pool",
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

  protected async execute(): Promise<void> {
    this.logger.info("🔄 CCIP Token Pool Set Router");
    this.logger.info("==========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (must be pool owner)
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

    if (solBalance < SET_ROUTER_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${SET_ROUTER_CONFIG.minSolRequired} SOL for transaction fees.\n` +
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

    const newRouter = config.routerProgramId; // Get router from config

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 ROUTER CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`CCIP Router (from config): ${newRouter.toString()}`);

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

      // Check if pool exists
      this.logger.info("");
      this.logger.info("🔍 VERIFYING POOL EXISTENCE");
      this.logger.info("==========================================");
      
      const poolExists = await tokenPoolClient.hasPool(tokenMint);
      this.logger.debug(`Pool exists: ${poolExists}`);

      if (!poolExists) {
        throw new Error(
          "Pool does not exist for this token mint.\n" +
          "Initialize the pool first using 'yarn svm:pool:initialize'\n" +
          `To initialize: yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
        );
      }

      this.logger.info("✅ Pool exists");

      // Get current pool info to show current router
      this.logger.info("");
      this.logger.info("🔍 CHECKING CURRENT ROUTER");
      this.logger.info("==========================================");
      
      try {
        const poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
        const currentRouter = poolInfo.config.config.router.toString();
        this.logger.info(`Current router: ${currentRouter}`);
        this.logger.info(`Pool owner: ${poolInfo.config.config.owner.toString()}`);

        if (currentRouter === newRouter.toString()) {
          this.logger.info("");
          this.logger.info("✅ ROUTER ALREADY SET CORRECTLY");
          this.logger.info("==========================================");
          this.logger.info("Router is already set to the configured CCIP router");
          this.logger.info("No changes needed");
          return;
        }

        this.logger.debug("Current pool details:", {
          poolType: poolInfo.poolType,
          owner: poolInfo.config.config.owner.toString(),
          version: poolInfo.config.version,
          decimals: poolInfo.config.config.decimals,
          currentRouter: currentRouter,
        });
      } catch (error) {
        this.logger.warn(`Could not fetch current pool info: ${error}`);
        this.logger.debug("Pool info fetch error:", error);
      }

      // Set the new router
      this.logger.info("");
      this.logger.info("🔧 SETTING ROUTER");
      this.logger.info("==========================================");
      this.logger.info("Setting router to configured CCIP router...");

      const signature = await tokenPoolClient.setRouter(tokenMint, {
        newRouter: newRouter,
        skipPreflight: this.options.skipPreflight,
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ ROUTER UPDATED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      // Verify the router update
      this.logger.info("");
      this.logger.info("🔍 VERIFYING ROUTER UPDATE");
      this.logger.info("==========================================");
      
      try {
        const updatedPoolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
        const updatedRouter = updatedPoolInfo.config.config.router.toString();

        if (updatedRouter === newRouter.toString()) {
          this.logger.info("✅ Router update verified successfully!");
          this.logger.info(`Updated router: ${updatedRouter}`);
          
          this.logger.debug("Router update verification details:", {
            newRouter: updatedRouter,
            owner: updatedPoolInfo.config.config.owner.toString(),
          });
        } else {
          this.logger.warn("Router update completed but verification shows different router");
          this.logger.warn(`Expected: ${newRouter.toString()}`);
          this.logger.warn(`Actual: ${updatedRouter}`);
        }
      } catch (error) {
        this.logger.warn(`Router transaction succeeded but verification failed: ${error}`);
        this.logger.debug("Verification error details:", error);
        this.logger.info("This may be due to network delays - the router should be updated shortly");
      }

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("View updated pool details:");
      this.logger.info(`  yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`);

      this.logger.info("");
      this.logger.info("🎉 Router Update Complete!");
      this.logger.info("✅ Pool router successfully updated to configured CCIP router");
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to set router: ${error instanceof Error ? error.message : String(error)}`
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
const command = new SetRouterCommand();
command.run().catch((error) => {
  process.exit(1);
});