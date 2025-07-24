/**
 * CCIP Basic Receiver Initialization Script (CLI Framework Version)
 *
 * This script initializes the CCIP Basic Receiver program on Solana.
 * It sets up the program state for CCIP message reception.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair, loadReceiverProgram } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for initialization operations
 */
const INITIALIZE_CONFIG = {
  minSolRequired: 0.1,
  defaultLogLevel: LogLevel.INFO,
  pdaSeeds: {
    state: "state",
    messagesStorage: "messages_storage",
    tokenAdmin: "token_admin",
  }
};

/**
 * Options specific to the initialize command
 */
interface InitializeOptions extends BaseCommandOptions {
  programId?: string;
}

/**
 * CCIP Basic Receiver Initialization Command
 */
class InitializeCommand extends CCIPCommand<InitializeOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "initialize",
      description: "🔧 CCIP Basic Receiver Initialization\\\\n\\\\nInitializes the CCIP Basic Receiver program on Solana. Sets up the program state, message storage, and token admin accounts for CCIP message reception.",
      examples: [
        "# Initialize receiver program with default config",
        "yarn svm:receiver:initialize",
        "",
        "# Initialize with custom program ID",
        "yarn svm:receiver:initialize --program-id 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "",
        "# Initialize with debug logging",
        "yarn svm:receiver:initialize --log-level DEBUG"
      ],
      notes: [
        `Minimum ${INITIALIZE_CONFIG.minSolRequired} SOL required for initialization`,
        "Creates three PDAs: state, messages_storage, and token_admin",
        "Uses init_if_needed pattern - safe to run multiple times",
        "Program must be deployed first with 'yarn svm:receiver:deploy'",
        "After initialization, program is ready to receive CCIP messages",
        "Tokens are processed dynamically, no additional setup needed",
        "Uses router program ID from configuration for CCIP integration"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "program-id",
        required: false,
        type: "string",
        description: "Custom receiver program ID (default: uses config)",
        example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
      }
    ];
  }

  /**
   * Resolve program ID from options or config
   */
  private resolveProgramId(config: any): PublicKey {
    if (this.options.programId) {
      try {
        const customProgramId = new PublicKey(this.options.programId);
        this.logger.info(`Using custom program ID: ${customProgramId.toString()}`);
        return customProgramId;
      } catch {
        throw new Error(`Invalid program ID format: ${this.options.programId}`);
      }
    }
    
    this.logger.info(`Using program ID from config: ${config.receiverProgramId.toString()}`);
    return config.receiverProgramId;
  }

  /**
   * Find all required PDAs
   */
  private findPDAs(programId: PublicKey): { 
    statePda: PublicKey; 
    messagesStoragePda: PublicKey; 
    tokenAdminPda: PublicKey 
  } {
    const [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(INITIALIZE_CONFIG.pdaSeeds.state)],
      programId
    );
    
    const [messagesStoragePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(INITIALIZE_CONFIG.pdaSeeds.messagesStorage)],
      programId
    );
    
    const [tokenAdminPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(INITIALIZE_CONFIG.pdaSeeds.tokenAdmin)],
      programId
    );

    return { statePda, messagesStoragePda, tokenAdminPda };
  }

  /**
   * Check initialization status of PDAs
   */
  private async checkInitializationStatus(
    program: any,
    pdas: { statePda: PublicKey; messagesStoragePda: PublicKey; tokenAdminPda: PublicKey }
  ): Promise<{ 
    isStateInitialized: boolean;
    isMessagesStorageInitialized: boolean; 
    isTokenAdminInitialized: boolean;
    allInitialized: boolean;
  }> {
    let isStateInitialized = false;
    let isMessagesStorageInitialized = false;
    let isTokenAdminInitialized = false;

    try {
      const stateAccountInfo = await program.provider.connection.getAccountInfo(pdas.statePda);
      if (stateAccountInfo !== null && stateAccountInfo.data.length > 0) {
        isStateInitialized = true;
        this.logger.info("✅ State account is already initialized");
      } else {
        this.logger.info("❌ State account needs initialization");
      }

      const messagesStorageInfo = await program.provider.connection.getAccountInfo(pdas.messagesStoragePda);
      if (messagesStorageInfo !== null && messagesStorageInfo.data.length > 0) {
        isMessagesStorageInitialized = true;
        this.logger.info("✅ Messages storage is already initialized");
      } else {
        this.logger.info("❌ Messages storage needs initialization");
      }

      const tokenAdminInfo = await program.provider.connection.getAccountInfo(pdas.tokenAdminPda);
      if (tokenAdminInfo !== null && tokenAdminInfo.data.length > 0) {
        isTokenAdminInitialized = true;
        this.logger.info("✅ Token admin is already initialized");
      } else {
        this.logger.info("❌ Token admin needs initialization");
      }
    } catch (error) {
      this.logger.debug(`Error checking account status: ${error}`);
    }

    const allInitialized = isStateInitialized && isMessagesStorageInitialized && isTokenAdminInitialized;

    return { 
      isStateInitialized, 
      isMessagesStorageInitialized, 
      isTokenAdminInitialized,
      allInitialized
    };
  }

  /**
   * Execute the initialization transaction
   */
  private async executeInitialization(
    program: any,
    pdas: { statePda: PublicKey; messagesStoragePda: PublicKey; tokenAdminPda: PublicKey },
    config: any
  ): Promise<string> {
    this.logger.info("Executing initialization transaction...");
    this.logger.info(`Router Program ID: ${config.routerProgramId.toString()}`);

    const tx = await program.methods
      .initialize(config.routerProgramId)
      .accounts({
        payer: program.provider.publicKey,
        state: pdas.statePda,
        messagesStorage: pdas.messagesStoragePda,
        tokenAdmin: pdas.tokenAdminPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  protected async execute(): Promise<void> {
    this.logger.info("🔧 CCIP Basic Receiver Initialization");
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
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < INITIALIZE_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${INITIALIZE_CONFIG.minSolRequired} SOL for initialization. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL\\n\\n` +
        `Request airdrop with:\\n` +
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
    }

    // Resolve program ID
    const programId = this.resolveProgramId(config);

    // Display program information
    this.logger.info("");
    this.logger.info("📋 PROGRAM INFORMATION");
    this.logger.info("==========================================");
    this.logger.info(`Receiver Program ID: ${programId.toString()}`);
    this.logger.info(`Router Program ID: ${config.routerProgramId.toString()}`);

    // Find PDAs
    this.logger.info("");
    this.logger.info("🔍 PROGRAM DERIVED ADDRESSES");
    this.logger.info("==========================================");
    const pdas = this.findPDAs(programId);
    this.logger.info(`State PDA: ${pdas.statePda.toString()}`);
    this.logger.info(`Messages Storage PDA: ${pdas.messagesStoragePda.toString()}`);
    this.logger.info(`Token Admin PDA: ${pdas.tokenAdminPda.toString()}`);

    // Load receiver program
    this.logger.info("");
    this.logger.info("📦 LOADING PROGRAM");
    this.logger.info("==========================================");
    const { program } = loadReceiverProgram(keypairPath, config.connection, programId);
    this.logger.info("Receiver program loaded successfully");

    // Check initialization status
    this.logger.info("");
    this.logger.info("🔍 CHECKING INITIALIZATION STATUS");
    this.logger.info("==========================================");
    const status = await this.checkInitializationStatus(program, pdas);

    if (status.allInitialized) {
      this.logger.info("");
      this.logger.info("✅ ALL ACCOUNTS ALREADY INITIALIZED");
      this.logger.info("==========================================");
      this.logger.info("Program is ready to receive CCIP messages");
      return;
    }

    // Execute initialization
    this.logger.info("");
    this.logger.info("🔧 INITIALIZING PROGRAM");
    this.logger.info("==========================================");
    const txSignature = await this.executeInitialization(program, pdas, config);

    // Display results
    this.logger.info("");
    this.logger.info("✅ INITIALIZATION SUCCESSFUL");
    this.logger.info("==========================================");
    this.logger.info(`Transaction Signature: ${txSignature}`);

    // Display explorer URL
    this.logger.info("");
    this.logger.info("🔍 EXPLORER URLS");
    this.logger.info("==========================================");
    this.logger.info(`Transaction: ${getExplorerUrl(config.id, txSignature)}`);

    this.logger.info("");
    this.logger.info("📋 NEXT STEPS");
    this.logger.info("==========================================");
    this.logger.info("1. Program is ready to receive CCIP messages and tokens");
    this.logger.info("2. Test message reception:");
    this.logger.info("   yarn svm:receiver:get-latest-message");
    this.logger.info("3. Send messages using router scripts:");
    this.logger.info("   yarn ccip:send");
    this.logger.info("   yarn ccip:message");
    this.logger.info("   yarn ccip:data-tokens");

    this.logger.info("");
    this.logger.info("🎉 Initialization Complete!");
    this.logger.info(`✅ Program initialized successfully`);
    this.logger.info(`✅ Ready to receive CCIP messages`);
    this.logger.info(`✅ Tokens are processed dynamically`);
  }
}

// Create and run the command
const command = new InitializeCommand();
command.run().catch((error) => {
  process.exit(1);
}); 