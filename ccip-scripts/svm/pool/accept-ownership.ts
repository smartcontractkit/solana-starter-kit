/**
 * Pool Accept Ownership Script (CLI Framework Version)
 *
 * This script accepts the ownership of a token pool by the proposed owner.
 * This is step 2 of a two-step ownership transfer process.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for accept ownership operations
 */
const ACCEPT_OWNERSHIP_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the accept-ownership command
 */
interface AcceptOwnershipOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
}

/**
 * Pool Accept Ownership Command
 */
class AcceptOwnershipCommand extends CCIPCommand<AcceptOwnershipOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "accept-ownership",
      description: "✅ Pool Ownership Acceptance\n\nAccepts the ownership of a token pool by the proposed owner. This is step 2 of a two-step ownership transfer process for security.",
      examples: [
        "# Accept pool ownership (you must be the proposed owner)",
        "yarn svm:pool:accept-ownership \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\",
        "  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh",
        "",
        "# With debug logging",
        "yarn svm:pool:accept-ownership \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\",
        "  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\",
        "  --log-level DEBUG"
      ],
      notes: [
        "✅ This completes the 2-step ownership transfer process",
        "Only callable by the proposed owner (set via transfer-ownership)",
        `Minimum ${ACCEPT_OWNERSHIP_CONFIG.minSolRequired} SOL required for transaction fees`,
        "You must be the proposed owner to execute this command",
        "Once accepted, you become the pool owner with full administrative rights",
        "Use 'yarn svm:pool:get-info' to verify ownership after acceptance",
        "Ensure you have secure access to this keypair before accepting"
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
        description: "Token mint address identifying the pool",
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
    this.logger.info("✅ CCIP Token Pool Accept Ownership");
    this.logger.info("==========================================");
    this.logger.warn("⚠️  Step 2 of 2-step ownership transfer process");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (must be proposed owner)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Proposed Owner (Wallet): ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("==========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < ACCEPT_OWNERSHIP_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${ACCEPT_OWNERSHIP_CONFIG.minSolRequired} SOL for transaction fees.\n` +
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

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 OWNERSHIP ACCEPTANCE CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Proposed Owner (You): ${walletKeypair.publicKey.toString()}`);

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

      // Check if pool exists and get current pool info for verification
      this.logger.info("");
      this.logger.info("🔍 VERIFYING POOL AND PENDING OWNERSHIP");
      this.logger.info("==========================================");
      this.logger.info("Checking pool exists and verifying pending ownership...");
      
      let poolInfo: BurnMintTokenPoolInfo;
      try {
        poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
        this.logger.info("✅ Pool exists");
        this.logger.info(`Current Pool Owner: ${poolInfo.config.config.owner.toString()}`);
        this.logger.info(`Current Proposed Owner: ${poolInfo.config.config.proposedOwner?.toString() || 'none'}`);

        this.logger.debug("Current pool details:", {
          poolType: poolInfo.poolType,
          owner: poolInfo.config.config.owner.toString(),
          proposedOwner: poolInfo.config.config.proposedOwner?.toString() || 'none',
          version: poolInfo.config.version,
          decimals: poolInfo.config.config.decimals,
          router: poolInfo.config.config.router.toString(),
        });
      } catch (error) {
        this.logger.error("");
        this.logger.error("❌ POOL NOT FOUND");
        this.logger.error("==========================================");
        this.logger.error("Pool does not exist for this token mint");
        this.logger.error("Initialize the pool first using 'yarn svm:pool:initialize'");
        this.logger.debug(
          `To initialize: yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
        );
        throw new Error("Pool does not exist for this token mint");
      }

      // Check if there's a pending ownership transfer to this wallet
      if (!poolInfo.config.config.proposedOwner || poolInfo.config.config.proposedOwner.equals(PublicKey.default)) {
        throw new Error(
          `No pending ownership transfer found.\n` +
          `Current Owner: ${poolInfo.config.config.owner.toString()}\n` +
          `Proposed Owner: none\n\n` +
          `The current owner must first propose you as the new owner using 'yarn svm:pool:transfer-ownership'.`
        );
      }

      // Verify current wallet is the proposed owner
      if (!poolInfo.config.config.proposedOwner.equals(walletKeypair.publicKey)) {
        throw new Error(
          `Access denied: You are not the proposed owner of this pool.\n` +
          `Proposed Owner: ${poolInfo.config.config.proposedOwner.toString()}\n` +
          `Your Wallet: ${walletKeypair.publicKey.toString()}\n\n` +
          `Only the proposed owner can accept ownership.`
        );
      }

      // Check if already the current owner (edge case)
      if (poolInfo.config.config.owner.equals(walletKeypair.publicKey)) {
        this.logger.info("");
        this.logger.info("ℹ️ ALREADY THE OWNER");
        this.logger.info("==========================================");
        this.logger.info("You are already the current owner of this pool.");
        this.logger.info("No action needed - ownership transfer not required.");
        return;
      }

      this.logger.info("✅ Verified: You are the proposed owner");

      // Accept ownership
      this.logger.info("");
      this.logger.info("🔧 ACCEPTING OWNERSHIP");
      this.logger.info("==========================================");
      this.logger.warn("⚠️  FINALIZING OWNERSHIP TRANSFER");
      this.logger.info("Executing ownership acceptance...");

      const signature = await tokenPoolClient.acceptAdminRole(tokenMint, {
        skipPreflight: this.options.skipPreflight,
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ OWNERSHIP ACCEPTED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      // Display summary
      this.logger.info("");
      this.logger.info("👤 OWNERSHIP TRANSFER COMPLETE");
      this.logger.info("==========================================");
      this.logger.info(`Token Mint: ${tokenMint.toString()}`);
      this.logger.info(`Previous Owner: ${poolInfo.config.config.owner.toString()}`);
      this.logger.info(`New Owner (You): ${walletKeypair.publicKey.toString()}`);
      this.logger.info(`Pool Program: ${burnMintPoolProgramId.toString()}`);
      this.logger.info(`Transaction: ${signature}`);

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("1. Verify the ownership transfer completed:");
      this.logger.info(`   yarn svm:pool:get-info --token-mint ${tokenMint.toString()}`);
      this.logger.info("");
      this.logger.info("2. You can now manage the pool as the owner:");
      this.logger.info("   • Configure remote chains for cross-chain transfers");
      this.logger.info("   • Set rate limits for security");
      this.logger.info("   • Transfer ownership to others if needed");
      this.logger.info("");
      this.logger.info("3. Keep your keypair secure - you are now the pool administrator");

      this.logger.info("");
      this.logger.info("🎉 Ownership Transfer Complete!");
      this.logger.info("✅ You are now the owner of this token pool");
      this.logger.info("🔧 You have full administrative rights over the pool");
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to accept ownership: ${error instanceof Error ? error.message : String(error)}`
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
const command = new AcceptOwnershipCommand();
command.run().catch((error) => {
  process.exit(1);
});
