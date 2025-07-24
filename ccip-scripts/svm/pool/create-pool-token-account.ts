/**
 * Pool Token Account Creation Script (CLI Framework Version)
 *
 * This script creates the Associated Token Account (ATA) for the pool signer PDA.
 * This account is required for the pool to hold tokens during cross-chain operations.
 */

import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { detectTokenProgram } from "../../../ccip-lib/svm";
import { findPoolSignerPDA } from "../../../ccip-lib/svm/utils/pdas/tokenpool";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for create pool token account operations
 */
const CREATE_POOL_ACCOUNT_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the create-pool-token-account command
 */
interface CreatePoolTokenAccountOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
}

/**
 * Create Pool Token Account Command
 */
class CreatePoolTokenAccountCommand extends CCIPCommand<CreatePoolTokenAccountOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "create-pool-token-account",
      description: "🏊 Pool Token Account Creator\n\nCreates the Associated Token Account (ATA) for the pool signer PDA. This account is required for the pool to hold tokens during cross-chain operations.",
      examples: [
        "# Create pool token account",
        "yarn svm:pool:create-token-account --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz",
        "",
        "# Create with debug logging",
        "yarn svm:pool:create-token-account --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz --log-level DEBUG"
      ],
      notes: [
        `Minimum ${CREATE_POOL_ACCOUNT_CONFIG.minSolRequired} SOL required for transaction fees`,
        "Pool must be initialized first (yarn svm:pool:initialize)",
        "Wallet must have sufficient SOL for transaction fees",
        "Token mint must exist and be valid",
        "Verifies the pool exists and gets configuration",
        "Calculates the pool signer PDA address",
        "Creates the Associated Token Account for the pool signer",
        "After running: pool can hold tokens during cross-chain operations",
        "Prevents 'AccountNotInitialized' errors in cross-chain transfers"
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
        description: "Token mint address for the pool",
        example: "4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY"
      },
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz"
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("🏊 CCIP Pool Token Account Creation");
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

    if (solBalance < CREATE_POOL_ACCOUNT_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${CREATE_POOL_ACCOUNT_CONFIG.minSolRequired} SOL for transaction fees.\n` +
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
    this.logger.info("📋 ACCOUNT CREATION CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);

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

      // Verify pool exists
      this.logger.info("");
      this.logger.info("🔍 VERIFYING POOL EXISTENCE");
      this.logger.info("==========================================");
      
      let poolInfo: BurnMintTokenPoolInfo;
      try {
        poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
        this.logger.info("✅ Pool exists");
      } catch (error) {
        throw new Error(
          "Pool does not exist for this token mint.\n" +
          "Initialize the pool first:\n" +
          `yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
        );
      }

      // Get pool info
      const currentPoolTokenAccount = poolInfo.config.config.poolTokenAccount;
      this.logger.info(`Current pool token account: ${currentPoolTokenAccount.toString()}`);

      // Determine token program ID
      const tokenProgramId = await detectTokenProgram(tokenMint, config.connection, this.logger);

      // Derive pool signer PDA
      const [poolSigner, poolSignerBump] = findPoolSignerPDA(tokenMint, burnMintPoolProgramId);
      this.logger.info(`Pool signer PDA: ${poolSigner.toString()}`);
      this.logger.debug(`Pool signer bump: ${poolSignerBump}`);

      // Check if pool signer matches what's in the pool config
      const configPoolSigner = poolInfo.config.config.poolSigner;
      if (!poolSigner.equals(configPoolSigner)) {
        this.logger.warn("Pool signer mismatch!");
        this.logger.warn(`  Calculated: ${poolSigner.toString()}`);
        this.logger.warn(`  In config:  ${configPoolSigner.toString()}`);
        this.logger.info("Using pool signer from configuration...");
      }

      // Use the pool signer from the configuration
      const actualPoolSigner = configPoolSigner;

      // Calculate the expected ATA
      const expectedATA = await getAssociatedTokenAddress(
        tokenMint,
        actualPoolSigner,
        true, // allowOwnerOffCurve
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      this.logger.info(`Expected pool token account (ATA): ${expectedATA.toString()}`);

      // Check if the expected ATA matches the current pool token account
      if (!expectedATA.equals(currentPoolTokenAccount)) {
        this.logger.warn("Pool token account mismatch!");
        this.logger.warn(`  Expected: ${expectedATA.toString()}`);
        this.logger.warn(`  Current:  ${currentPoolTokenAccount.toString()}`);
        this.logger.info("This script will create the expected ATA...");
      }

      // Check if the ATA already exists
      this.logger.info("");
      this.logger.info("🔍 CHECKING EXISTING ACCOUNT");
      this.logger.info("==========================================");
      
      const existingAccount = await config.connection.getAccountInfo(expectedATA);

      if (existingAccount) {
        this.logger.info("");
        this.logger.info("✅ ACCOUNT ALREADY EXISTS");
        this.logger.info("==========================================");
        this.logger.info("Pool token account already exists!");
        this.logger.info(`Account address: ${expectedATA.toString()}`);
        this.logger.info(`Owner: ${actualPoolSigner.toString()}`);
        this.logger.info("No action needed.");
        return;
      }

      // Create the ATA
      this.logger.info("");
      this.logger.info("🔧 CREATING POOL TOKEN ACCOUNT");
      this.logger.info("==========================================");
      this.logger.info("Creating pool token account (ATA)...");
      
      this.logger.debug("Creating ATA for:");
      this.logger.debug(`  Mint: ${tokenMint.toString()}`);
      this.logger.debug(`  Owner (Pool Signer): ${actualPoolSigner.toString()}`);
      this.logger.debug(`  Payer: ${walletKeypair.publicKey.toString()}`);
      this.logger.debug(`  Token Program: ${tokenProgramId.toString()}`);

      const createATAInstruction = createAssociatedTokenAccountInstruction(
        walletKeypair.publicKey, // payer
        expectedATA, // ata address
        actualPoolSigner, // owner of the ATA (pool signer)
        tokenMint, // token mint
        tokenProgramId, // token program
        ASSOCIATED_TOKEN_PROGRAM_ID // ATA program
      );

      // Create and send transaction
      const transaction = new Transaction().add(createATAInstruction);

      this.logger.debug("Sending transaction...");
      const signature = await sendAndConfirmTransaction(
        config.connection,
        transaction,
        [walletKeypair],
        {
          skipPreflight: this.options.skipPreflight,
          commitment: config.connection.commitment,
        }
      );

      // Display results
      this.logger.info("");
      this.logger.info("✅ POOL TOKEN ACCOUNT CREATED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);
      this.logger.info(`Pool Token Account Address: ${expectedATA.toString()}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      // Verify creation
      this.logger.info("");
      this.logger.info("🔍 VERIFYING ACCOUNT CREATION");
      this.logger.info("==========================================");
      
      const verificationAccount = await config.connection.getAccountInfo(expectedATA);

      if (verificationAccount) {
        this.logger.info("✅ Account creation verified!");
        this.logger.debug(`Account owner: ${verificationAccount.owner.toString()}`);
        this.logger.debug(`Account lamports: ${verificationAccount.lamports}`);
      } else {
        this.logger.warn("⚠️ Account verification failed - this may be due to network delays");
      }

      this.logger.info("");
      this.logger.info("🎉 Pool Token Account Setup Complete!");
      this.logger.info(`✅ ATA Address: ${expectedATA.toString()}`);
      this.logger.info(`✅ Owner: ${actualPoolSigner.toString()} (Pool Signer PDA)`);
      this.logger.info(`✅ Ready for cross-chain token operations`);
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("insufficient funds")) {
          this.logger.error("Insufficient SOL for transaction fees");
          this.logger.info("Request more SOL from the devnet faucet");
        } else if (error.message.includes("already in use")) {
          this.logger.info("Account may already exist - check with get-pool-info");
        }
      }

      this.logger.error(
        `❌ Failed to create pool token account: ${error instanceof Error ? error.message : String(error)}`
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
const command = new CreatePoolTokenAccountCommand();
command.run().catch((error) => {
  process.exit(1);
});