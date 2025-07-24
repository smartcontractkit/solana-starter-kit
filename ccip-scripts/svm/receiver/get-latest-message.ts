/**
 * CCIP Basic Receiver Get Latest Message Script (CLI Framework Version)
 *
 * This script fetches the latest message received by the CCIP Basic Receiver program on Solana.
 * It calls the get_latest_message instruction and displays the message details.
 */

import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { resolveNetworkConfig } from "../../config";
import { getKeypairPath, loadKeypair, loadReceiverProgram } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for get latest message operations
 */
const GET_MESSAGE_CONFIG = {
  pdaSeeds: {
    messagesStorage: "messages_storage",
  },
  messageTypes: {
    'tokenTransfer': 'Token Transfer',
    'arbitraryMessaging': 'Arbitrary Messaging',
    'programmaticTokenTransfer': 'Programmatic Token Transfer'
  },
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the get-latest-message command
 */
interface GetLatestMessageOptions extends BaseCommandOptions {
  programId?: string;
}

/**
 * CCIP Basic Receiver Get Latest Message Command
 */
class GetLatestMessageCommand extends CCIPCommand<GetLatestMessageOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "get-latest-message",
      description: "📨 CCIP Message Reader\\\\n\\\\nFetches and displays the latest message received by the CCIP Basic Receiver program. Shows message details including sender, data, tokens, and timestamps.",
      examples: [
        "# Get latest message with default config",
        "yarn svm:receiver:get-latest-message",
        "",
        "# Get latest message with custom program ID",
        "yarn svm:receiver:get-latest-message --program-id 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "",
        "# Get latest message with debug logging",
        "yarn svm:receiver:get-latest-message --log-level DEBUG"
      ],
      notes: [
        "Program must be initialized first with 'yarn svm:receiver:initialize'",
        "At least one message must be received to display results",
        "Shows message ID, source chain, sender, and timestamp",
        "Displays both hex and text versions of message data when possible",
        "Lists all token transfers included in the message",
        "Supports different message types: Token Transfer, Arbitrary Messaging, etc.",
        "Wallet is used for querying purposes only (no transactions)"
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
   * Find messages storage PDA
   */
  private findMessagesStoragePDA(programId: PublicKey): PublicKey {
    const [messagesStoragePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GET_MESSAGE_CONFIG.pdaSeeds.messagesStorage)],
      programId
    );
    return messagesStoragePda;
  }

  /**
   * Check if messages storage is initialized
   */
  private async checkMessagesStorageInitialized(
    program: any,
    messagesStoragePda: PublicKey
  ): Promise<boolean> {
    try {
      const msgStorageAccountInfo = await program.provider.connection.getAccountInfo(messagesStoragePda);
      return msgStorageAccountInfo !== null && msgStorageAccountInfo.data.length > 0;
    } catch (error) {
      this.logger.debug(`Error checking messages storage: ${error}`);
      return false;
    }
  }

  /**
   * Convert message type enum to human-readable string
   */
  private getMessageTypeName(messageType: any): string {
    if (!messageType) return 'Unknown';
    const typeKey = Object.keys(messageType)[0];
    return GET_MESSAGE_CONFIG.messageTypes[typeKey] || `Unknown (${typeKey})`;
  }

  /**
   * Format and display message information
   */
  private displayMessageInfo(latestMessage: any): void {
    this.logger.info("");
    this.logger.info("📨 LATEST RECEIVED MESSAGE");
    this.logger.info("==========================================");
    
    // Basic message information
    this.logger.info(`Message ID: 0x${Buffer.from(latestMessage.messageId).toString('hex')}`);
    this.logger.info(`Source Chain Selector: ${latestMessage.sourceChainSelector.toString()}`);
    this.logger.info(`Sender: 0x${Buffer.from(latestMessage.sender).toString('hex')}`);
    this.logger.info(`Message Type: ${this.getMessageTypeName(latestMessage.messageType)}`);
    this.logger.info(`Received Timestamp: ${new Date(latestMessage.receivedTimestamp * 1000).toISOString()}`);

    // Message data
    this.logger.info("");
    this.logger.info("📄 MESSAGE DATA");
    this.logger.info("-".repeat(40));
    if (latestMessage.data && latestMessage.data.length > 0) {
      const dataHex = Buffer.from(latestMessage.data).toString('hex');
      this.logger.info(`Data (hex): 0x${dataHex}`);
      this.logger.info(`Data length: ${latestMessage.data.length} bytes`);
      
      // Try to decode as UTF-8 text
      try {
        const dataText = Buffer.from(latestMessage.data).toString('utf8');
        // Check if it's printable text (contains mostly ASCII characters)
        const isPrintable = /^[\x20-\x7E\s]*$/.test(dataText);
        if (isPrintable && dataText.trim().length > 0) {
          this.logger.info(`Data (text): "${dataText}"`);
        } else {
          this.logger.info("Data contains non-printable characters");
        }
      } catch (error) {
        this.logger.info("Data could not be decoded as UTF-8 text");
      }
    } else {
      this.logger.info("No data payload in this message");
    }

    // Token transfers
    this.logger.info("");
    this.logger.info("💰 TOKEN TRANSFERS");
    this.logger.info("-".repeat(40));
    if (latestMessage.tokenAmounts && latestMessage.tokenAmounts.length > 0) {
      this.logger.info(`Found ${latestMessage.tokenAmounts.length} token transfer(s):`);
      latestMessage.tokenAmounts.forEach((tokenAmount: any, index: number) => {
        this.logger.info(`  Transfer ${index + 1}:`);
        this.logger.info(`    Token: ${tokenAmount.token.toString()}`);
        this.logger.info(`    Amount: ${tokenAmount.amount.toString()}`);
      });
    } else {
      this.logger.info("No tokens transferred in this message");
    }

    this.logger.info("");
    this.logger.info("==========================================");
  }

  protected async execute(): Promise<void> {
    this.logger.info("📨 CCIP Basic Receiver - Get Latest Message");
    this.logger.info("==========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (for querying purposes)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Querying as: ${walletKeypair.publicKey.toString()}`);

    // Resolve program ID
    const programId = this.resolveProgramId(config);

    // Display program information
    this.logger.info("");
    this.logger.info("📋 PROGRAM INFORMATION");
    this.logger.info("==========================================");
    this.logger.info(`Receiver Program ID: ${programId.toString()}`);

    // Find messages storage PDA
    this.logger.info("");
    this.logger.info("🔍 MESSAGES STORAGE");
    this.logger.info("==========================================");
    const messagesStoragePda = this.findMessagesStoragePDA(programId);
    this.logger.info(`Messages Storage PDA: ${messagesStoragePda.toString()}`);

    // Load receiver program
    this.logger.info("");
    this.logger.info("📦 LOADING PROGRAM");
    this.logger.info("==========================================");
    const { program } = loadReceiverProgram(keypairPath, config.connection, programId);
    this.logger.info("Receiver program loaded successfully");

    // Check if messages storage is initialized
    this.logger.info("");
    this.logger.info("🔍 CHECKING STORAGE STATUS");
    this.logger.info("==========================================");
    const isInitialized = await this.checkMessagesStorageInitialized(program, messagesStoragePda);
    
    if (!isInitialized) {
      this.logger.info("");
      this.logger.info("❌ MESSAGES STORAGE NOT INITIALIZED");
      this.logger.info("==========================================");
      this.logger.info("The messages storage account is not initialized yet.");
      this.logger.info("");
      this.logger.info("This means either:");
      this.logger.info("1. The receiver program hasn't been initialized");
      this.logger.info("2. No messages have been received yet");
      this.logger.info("");
      this.logger.info("📋 NEXT STEPS:");
      this.logger.info("1. Initialize the receiver program:");
      this.logger.info("   yarn svm:receiver:initialize");
      this.logger.info("2. Send a message to trigger storage creation:");
      this.logger.info("   yarn ccip:send");
      this.logger.info("   yarn ccip:message");
      this.logger.info("   yarn ccip:data-tokens");
      return;
    }

    // Fetch the latest message
    this.logger.info("");
    this.logger.info("🔄 FETCHING LATEST MESSAGE");
    this.logger.info("==========================================");
    this.logger.info("Querying receiver program for latest message...");

    try {
      const latestMessage = await program.methods
        .getLatestMessage()
        .accounts({
          messagesStorage: messagesStoragePda,
        })
        .view();

      // Check if message exists
      if (!latestMessage || !latestMessage.messageId) {
        this.logger.info("");
        this.logger.info("📭 NO MESSAGES RECEIVED");
        this.logger.info("==========================================");
        this.logger.info("The receiver has been initialized but no messages have been received yet.");
        this.logger.info("");
        this.logger.info("📋 NEXT STEPS:");
        this.logger.info("Send a message using one of these commands:");
        this.logger.info("• yarn ccip:send        (token transfer)");
        this.logger.info("• yarn ccip:message     (arbitrary messaging)");
        this.logger.info("• yarn ccip:data-tokens (data + tokens)");
        return;
      }

      // Display the message information
      this.displayMessageInfo(latestMessage);

      this.logger.info("");
      this.logger.info("🎉 Message Retrieved Successfully!");
      this.logger.info(`✅ Latest message from chain ${latestMessage.sourceChainSelector.toString()}`);
      this.logger.info(`✅ Received at ${new Date(latestMessage.receivedTimestamp * 1000).toISOString()}`);

    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch latest message: ${error instanceof Error ? error.message : String(error)}`
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
const command = new GetLatestMessageCommand();
command.run().catch((error) => {
  process.exit(1);
}); 