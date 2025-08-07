/**
 * Pool Transfer Ownership Script (CLI Framework Version)
 *
 * This script transfers the ownership of a token pool to a new administrator.
 * This is step 1 of a two-step ownership transfer process.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for transfer ownership operations
 */
const TRANSFER_OWNERSHIP_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the transfer-ownership command
 */
interface TransferOwnershipOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
  newOwner: string;
}

/**
 * Pool Transfer Ownership Command
 */
class TransferOwnershipCommand extends CCIPCommand<TransferOwnershipOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "transfer-ownership",
      description: "👤 Pool Ownership Transfer\n\nTransfers the ownership of a token pool to a new administrator. This is step 1 of a two-step ownership transfer process for security.",
      examples: [
        "# Transfer pool ownership to new administrator",
        "yarn svm:pool:transfer-ownership \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\",
        "  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\",
        "  --new-owner 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T",
        "",
        "# With debug logging",
        "yarn svm:pool:transfer-ownership \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\",
        "  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\",
        "  --new-owner 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T \\",
        "  --log-level DEBUG"
      ],
      notes: [
        "⚠️ SECURITY: This is step 1 of a 2-step process - the new owner must accept",
        "Only callable by the current pool owner",
        `Minimum ${TRANSFER_OWNERSHIP_CONFIG.minSolRequired} SOL required for transaction fees`,
        "The new owner must call 'accept-ownership' to complete the transfer",
        "Always verify the new owner address before executing",
        "Use 'yarn svm:pool:get-info' to check current ownership status",
        "Test ownership transfers on devnet before mainnet"
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
      },
      {
        name: "new-owner",
        required: true,
        type: "string",
        description: "PublicKey of the proposed new pool owner",
        example: "8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T"
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("👤 CCIP Token Pool Transfer Ownership");
    this.logger.info("==========================================");
    this.logger.warn("⚠️  Step 1 of 2-step ownership transfer process");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (must be current owner)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Current Owner (Wallet): ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("==========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < TRANSFER_OWNERSHIP_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${TRANSFER_OWNERSHIP_CONFIG.minSolRequired} SOL for transaction fees.\n` +
        `Current balance: ${solBalance.toFixed(9)} SOL\n\n` +
        `Request airdrop with:\n` +
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
    }

    // Parse and validate addresses
    let tokenMint: PublicKey;
    let burnMintPoolProgramId: PublicKey;
    let newOwner: PublicKey;
    
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
    
    try {
      newOwner = new PublicKey(this.options.newOwner);
    } catch {
      throw new Error(`Invalid new owner address: ${this.options.newOwner}`);
    }

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 OWNERSHIP TRANSFER CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Current Owner: ${walletKeypair.publicKey.toString()}`);
    this.logger.info(`Proposed New Owner: ${newOwner.toString()}`);

    // Validate addresses
    if (walletKeypair.publicKey.equals(newOwner)) {
      this.logger.warn("⚠️  Warning: Transferring ownership to the same address (current owner)");
      this.logger.warn("This operation will still work but is typically not necessary");
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

      // Check if pool exists and get current pool info for verification
      this.logger.info("");
      this.logger.info("🔍 VERIFYING POOL OWNERSHIP");
      this.logger.info("==========================================");
      this.logger.info("Checking pool exists and verifying current ownership...");
      
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

      // Verify current wallet is the owner
      if (!poolInfo.config.config.owner.equals(walletKeypair.publicKey)) {
        throw new Error(
          `Access denied: You are not the current owner of this pool.\n` +
          `Current Owner: ${poolInfo.config.config.owner.toString()}\n` +
          `Your Wallet: ${walletKeypair.publicKey.toString()}\n\n` +
          `Only the current owner can transfer ownership.`
        );
      }

      // Check if there's already a pending ownership transfer
      if (poolInfo.config.config.proposedOwner && !poolInfo.config.config.proposedOwner.equals(PublicKey.default)) {
        if (poolInfo.config.config.proposedOwner.equals(newOwner)) {
          this.logger.info("");
          this.logger.info("ℹ️ OWNERSHIP ALREADY PROPOSED");
          this.logger.info("==========================================");
          this.logger.info(`${newOwner.toString()} is already the proposed owner.`);
          this.logger.info("No action needed - they can accept ownership using 'yarn svm:pool:accept-ownership'");
          return;
        } else {
          this.logger.warn("");
          this.logger.warn("⚠️  EXISTING PENDING TRANSFER");
          this.logger.warn("==========================================");
          this.logger.warn(`There is already a pending ownership transfer to: ${poolInfo.config.config.proposedOwner.toString()}`);
          this.logger.warn("This operation will replace the pending transfer.");
        }
      }

      // Transfer ownership
      this.logger.info("");
      this.logger.info("🔧 TRANSFERRING OWNERSHIP");
      this.logger.info("==========================================");
      this.logger.warn("⚠️  PROPOSING NEW OWNER");
      this.logger.info("Executing ownership transfer proposal...");

      const signature = await tokenPoolClient.transferAdminRole(tokenMint, {
        newAdmin: newOwner,
        skipPreflight: this.options.skipPreflight,
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ OWNERSHIP TRANSFER PROPOSED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      // Display summary
      this.logger.info("");
      this.logger.info("👤 OWNERSHIP TRANSFER SUMMARY");
      this.logger.info("==========================================");
      this.logger.info(`Token Mint: ${tokenMint.toString()}`);
      this.logger.info(`Current Owner: ${walletKeypair.publicKey.toString()}`);
      this.logger.info(`Proposed New Owner: ${newOwner.toString()}`);
      this.logger.info(`Pool Program: ${burnMintPoolProgramId.toString()}`);
      this.logger.info(`Transaction: ${signature}`);

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("1. The proposed owner must accept ownership:");
      this.logger.info(`   yarn svm:pool:accept-ownership \\`);
      this.logger.info(`     --token-mint ${tokenMint.toString()} \\`);
      this.logger.info(`     --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`);
      this.logger.info(`   (Must be run by: ${newOwner.toString()})`);
      this.logger.info("");
      this.logger.info("2. Verify the ownership transfer:");
      this.logger.info(`   yarn svm:pool:get-info --token-mint ${tokenMint.toString()}`);
      this.logger.info("");
      this.logger.info("3. Until accepted, you remain the owner and can cancel by proposing yourself");

      this.logger.info("");
      this.logger.info("🎉 Ownership Transfer Proposal Complete!");
      this.logger.info("✅ Ownership transfer successfully proposed");
      this.logger.info("⏳ Waiting for new owner to accept the transfer");
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to transfer ownership: ${error instanceof Error ? error.message : String(error)}`
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
const command = new TransferOwnershipCommand();
command.run().catch((error) => {
  process.exit(1);
});
