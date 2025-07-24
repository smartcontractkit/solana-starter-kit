/**
 * CCIP Basic Receiver Storage Closure Script (CLI Framework Version)
 *
 * This script closes the CCIP Basic Receiver state and messages storage accounts.
 * It sends the rent lamports back to the owner and is useful for resetting program state.
 */

import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair, loadReceiverProgram } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for close storage operations
 */
const CLOSE_STORAGE_CONFIG = {
  pdaSeeds: {
    state: "state",
    messagesStorage: "messages_storage",
    tokenAdmin: "token_admin",
  },
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the close-storage command
 */
interface CloseStorageOptions extends BaseCommandOptions {
  programId?: string;
}

/**
 * CCIP Basic Receiver Storage Closure Command
 */
class CloseStorageCommand extends CCIPCommand<CloseStorageOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "close-storage",
      description: "🗑️ CCIP Storage Cleanup\\\\n\\\\nCloses the CCIP Basic Receiver state and messages storage accounts, sending rent lamports back to the owner. Useful for resetting program state when needed.",
      examples: [
        "# Close storage accounts with default config",
        "yarn svm:receiver:close-storage",
        "",
        "# Close storage with custom program ID",
        "yarn svm:receiver:close-storage --program-id 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "",
        "# Close storage with debug logging",
        "yarn svm:receiver:close-storage --log-level DEBUG"
      ],
      notes: [
        "⚠️ DESTRUCTIVE OPERATION - This will delete stored messages",
        "Only the original program owner can close storage accounts",
        "Closes state and messages_storage PDAs, recovers rent lamports",
        "Token admin PDA remains untouched for reinitialization",
        "After closure, you MUST run 'yarn svm:receiver:initialize' again",
        "Useful for resetting program state during development",
        "Will fail if the keypair doesn't match the original owner",
        "No effect if accounts are already closed"
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
   * Find all relevant PDAs
   */
  private findPDAs(programId: PublicKey): { 
    statePda: PublicKey; 
    messagesStoragePda: PublicKey; 
    tokenAdminPda: PublicKey;
  } {
    const [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(CLOSE_STORAGE_CONFIG.pdaSeeds.state)],
      programId
    );
    
    const [messagesStoragePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(CLOSE_STORAGE_CONFIG.pdaSeeds.messagesStorage)],
      programId
    );
    
    const [tokenAdminPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(CLOSE_STORAGE_CONFIG.pdaSeeds.tokenAdmin)],
      programId
    );

    return { statePda, messagesStoragePda, tokenAdminPda };
  }

  /**
   * Check current account states
   */
  private async checkAccountStates(
    program: any,
    pdas: { statePda: PublicKey; messagesStoragePda: PublicKey; tokenAdminPda: PublicKey }
  ): Promise<{
    stateInfo: any;
    messagesStorageInfo: any;
    tokenAdminInfo: any;
    hasAccountsToClose: boolean;
  }> {
    const stateInfo = await program.provider.connection.getAccountInfo(pdas.statePda);
    const messagesStorageInfo = await program.provider.connection.getAccountInfo(pdas.messagesStoragePda);
    const tokenAdminInfo = await program.provider.connection.getAccountInfo(pdas.tokenAdminPda);

    this.logger.info("Current account states:");
    
    if (stateInfo === null) {
      this.logger.info("❌ State account: Does not exist or already closed");
    } else {
      this.logger.info(`✅ State account: ${stateInfo.data.length} bytes, ${(stateInfo.lamports / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    }
    
    if (messagesStorageInfo === null) {
      this.logger.info("❌ Messages storage: Does not exist or already closed");
    } else {
      this.logger.info(`✅ Messages storage: ${messagesStorageInfo.data.length} bytes, ${(messagesStorageInfo.lamports / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    }
    
    if (tokenAdminInfo === null) {
      this.logger.info("❌ Token admin: Does not exist");
    } else {
      this.logger.info(`ℹ️  Token admin: ${tokenAdminInfo.data.length} bytes, ${(tokenAdminInfo.lamports / LAMPORTS_PER_SOL).toFixed(9)} SOL (will remain open)`);
    }

    const hasAccountsToClose = stateInfo !== null || messagesStorageInfo !== null;
    return { stateInfo, messagesStorageInfo, tokenAdminInfo, hasAccountsToClose };
  }

  /**
   * Execute the close storage transaction
   */
  private async executeCloseStorage(
    program: any,
    pdas: { statePda: PublicKey; messagesStoragePda: PublicKey; tokenAdminPda: PublicKey },
    ownerKeypair: any
  ): Promise<string> {
    this.logger.info("Executing close storage transaction...");

    const tx = await program.methods
      .closeStorage()
      .accounts({
        state: pdas.statePda,
        messagesStorage: pdas.messagesStoragePda,
        owner: ownerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([ownerKeypair])
      .rpc();

    return tx;
  }

  /**
   * Verify account closure results
   */
  private async verifyAccountClosure(
    program: any,
    pdas: { statePda: PublicKey; messagesStoragePda: PublicKey; tokenAdminPda: PublicKey }
  ): Promise<{ stateClosedSuccessfully: boolean; messagesStorageClosedSuccessfully: boolean }> {
    this.logger.info("Verifying account closure...");
    
    const postStateInfo = await program.provider.connection.getAccountInfo(pdas.statePda);
    const postMessagesStorageInfo = await program.provider.connection.getAccountInfo(pdas.messagesStoragePda);
    
    const stateClosedSuccessfully = postStateInfo === null;
    const messagesStorageClosedSuccessfully = postMessagesStorageInfo === null;

    if (stateClosedSuccessfully) {
      this.logger.info("✅ State account successfully closed");
    } else {
      this.logger.warn("⚠️  State account still exists after close operation");
    }
    
    if (messagesStorageClosedSuccessfully) {
      this.logger.info("✅ Messages storage account successfully closed");
    } else {
      this.logger.warn("⚠️  Messages storage account still exists after close operation");
    }

    return { stateClosedSuccessfully, messagesStorageClosedSuccessfully };
  }

  protected async execute(): Promise<void> {
    this.logger.info("🗑️ CCIP Basic Receiver Storage Closure");
    this.logger.info("==========================================");

    // Show warning about destructive operation
    this.logger.info("");
    this.logger.info("⚠️  DESTRUCTIVE OPERATION WARNING");
    this.logger.info("==========================================");
    this.logger.info("This will permanently delete:");
    this.logger.info("• Program state account");
    this.logger.info("• All stored messages");
    this.logger.info("• Messages storage account");
    this.logger.info("");
    this.logger.info("Rent lamports will be returned to the owner.");
    this.logger.info("You must reinitialize after closure.");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (must be the original owner)
    const keypairPath = getKeypairPath(this.options);
    const ownerKeypair = loadKeypair(keypairPath);
    
    this.logger.info("");
    this.logger.info("👤 OWNER INFORMATION");
    this.logger.info("==========================================");
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Owner wallet: ${ownerKeypair.publicKey.toString()}`);
    this.logger.info("Note: This must be the same keypair used during initialization");

    // Resolve program ID
    const programId = this.resolveProgramId(config);

    // Display program information
    this.logger.info("");
    this.logger.info("📋 PROGRAM INFORMATION");
    this.logger.info("==========================================");
    this.logger.info(`Receiver Program ID: ${programId.toString()}`);

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

    // Check current account states
    this.logger.info("");
    this.logger.info("🔍 CHECKING ACCOUNT STATES");
    this.logger.info("==========================================");
    const accountStates = await this.checkAccountStates(program, pdas);

    if (!accountStates.hasAccountsToClose) {
      this.logger.info("");
      this.logger.info("ℹ️  NO ACCOUNTS TO CLOSE");
      this.logger.info("==========================================");
      this.logger.info("All target accounts are already closed or don't exist.");
      this.logger.info("No action needed.");
      return;
    }

    // Execute close storage
    this.logger.info("");
    this.logger.info("🗑️ CLOSING STORAGE ACCOUNTS");
    this.logger.info("==========================================");
    
    try {
      const txSignature = await this.executeCloseStorage(program, pdas, ownerKeypair);

      // Verify closure
      this.logger.info("");
      this.logger.info("🔍 VERIFYING CLOSURE");
      this.logger.info("==========================================");
      const closureResults = await this.verifyAccountClosure(program, pdas);

      // Display results
      this.logger.info("");
      this.logger.info("✅ STORAGE CLOSURE COMPLETED");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${txSignature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, txSignature)}`);

      this.logger.info("");
      this.logger.info("⚠️  IMPORTANT NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("The receiver program accounts have been closed.");
      this.logger.info("You MUST reinitialize before the receiver can function again:");
      this.logger.info("");
      this.logger.info("  yarn svm:receiver:initialize");
      this.logger.info("");
      this.logger.info("This will recreate the necessary accounts for message reception.");

      this.logger.info("");
      this.logger.info("🎉 Storage Closure Complete!");
      this.logger.info(`✅ Rent lamports returned to owner`);
      this.logger.info(`✅ Program state reset`);
      
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("Owner does not match") || error.message.includes("owner")) {
          this.logger.error("");
          this.logger.error("❌ OWNERSHIP ERROR");
          this.logger.error("==========================================");
          this.logger.error("The keypair provided is not the owner of the program accounts.");
          this.logger.error("Ensure you're using the same keypair that was used during initialization.");
          throw error;
        }
      }

      this.logger.error(
        `❌ Failed to close storage: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new CloseStorageCommand();
command.run().catch((error) => {
  process.exit(1);
}); 