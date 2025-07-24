/**
 * EVM to Solana CCIP Arbitrary Messaging (CLI Framework Version)
 *
 * This script demonstrates how to send arbitrary messages from Ethereum to Solana
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol). No tokens are transferred.
 * 
 * Professional CLI framework implementation with type safety,
 * argument validation, and consistent help formatting.
 */

import {
  CCIPCommand,
  ArgumentDefinition,
  CommandMetadata,
  BaseCommandOptions,
} from "../utils/cli-framework";
import { setupClientContext } from "../utils/setup-client";
import {
  createCCIPMessageRequest,
  displayTransferSummary,
  displayTransferResults,
} from "../utils/message-utils";
import { PublicKey } from "@solana/web3.js";
import { ChainId, FeeTokenType, getCCIPSVMConfig, getEVMConfig } from "../../config";
// Import to ensure environment variables are loaded
import "../utils/config-parser";

/**
 * Utility function to derive PDAs for CCIP Receiver accounts
 * 
 * @param receiverProgramId - The CCIP Receiver program ID
 * @returns Object containing the derived PDAs
 */
function deriveReceiverPDAs(receiverProgramIdStr: string) {
  // Convert string to PublicKey
  const receiverProgramId = new PublicKey(receiverProgramIdStr);
  
  // Seeds for PDAs (these match the ones in the Rust program)
  const STATE_SEED = Buffer.from("state");
  const MESSAGES_STORAGE_SEED = Buffer.from("messages_storage");
  
  // Derive the state PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [STATE_SEED],
    receiverProgramId
  );
  
  // Derive the messages storage PDA
  const [messagesStoragePda] = PublicKey.findProgramAddressSync(
    [MESSAGES_STORAGE_SEED],
    receiverProgramId
  );
  
  return {
    state: statePda,
    messagesStorage: messagesStoragePda
  };
}

/**
 * Options specific to the arbitrary messaging command
 */
interface ArbitraryMessagingOptions extends BaseCommandOptions {
  // Messaging specific options
  sourceChain?: ChainId;
  messageData?: string;
  defaultReceiver?: string;
  defaultComputeUnits?: number;
}

/**
 * Arbitrary Messaging Command Implementation
 */
class ArbitraryMessagingCommand extends CCIPCommand<ArbitraryMessagingOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "arbitrary-messaging",
      description:
        "📨 EVM to Solana CCIP Arbitrary Messaging\n\nSend custom messages from EVM chains (Ethereum, Avalanche) to Solana using Chainlink CCIP. Perfect for cross-chain communication without token transfers.",
      examples: [
        "# Send simple text message",
        'yarn evm:arbitrary-message --data "Hello, Solana!"',
        "",
        "# Send hex-encoded message",
        "yarn evm:arbitrary-message --data 0x48656c6c6f2c20536f6c616e6121",
        "",
        "# Send message with custom compute units",
        'yarn evm:arbitrary-message --data "Complex message" --compute-units 200000',
        "",
        "# Use different fee token",
        'yarn evm:arbitrary-message --data "Hello!" --fee-token native --log-level DEBUG',
        "",
        "# Send to custom receiver",
        'yarn evm:arbitrary-message --data "Custom receiver" --receiver 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      ],
      notes: [
        "Requires EVM_PRIVATE_KEY in environment variables",
        "Default source chain is Ethereum Sepolia",
        "No tokens are transferred - only messages",
        "Message data can be plain text or hex (with 0x prefix)",
        "Receiver address specifies where message is delivered on Solana",
        "Compute units determine execution complexity on Solana",
        "Higher compute units needed for complex message processing",
      ],
    };

    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "source-chain",
        aliases: ["s"],
        type: "string",
        description: "Source chain to send from",
        defaultValue: ChainId.ETHEREUM_SEPOLIA,
        example: "ethereum-sepolia",
      },
      {
        name: "data",
        aliases: ["d", "message"],
        type: "string",
        description: "Message data to send (text or hex with 0x prefix)",
        defaultValue: "Hello, Solana from EVM!",
        example: "Hello, Solana!",
      },
      {
        name: "receiver",
        aliases: ["r"],
        type: "string",
        description: "Solana receiver address for the message",
        example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      },
      {
        name: "compute-units",
        aliases: ["cu"],
        type: "number",
        description: "Solana compute units for message processing",
        defaultValue: 50000,
        example: "200000",
      },
    ];
  }

  /**
   * Get default receiver based on destination chain
   */
  private getDefaultReceiver(): string {
    // Get the Solana CCIP configuration to derive a reasonable default receiver
    const solanaConfig = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
    
    // For messaging, use the receiver program ID as the default
    // This is the program that will receive and process the message
    return solanaConfig.receiverProgramId.toString();
  }

  protected async execute(): Promise<void> {
    this.logger.info("📨 EVM to Solana CCIP Arbitrary Messaging");
    this.logger.info("=========================================");

    try {
      // Prepare messaging configuration
      const sourceChain = this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA;
      const sourceChainConfig = getEVMConfig(sourceChain);

      // Prepare message data
      const messageData = this.options.messageData || this.options.data || "Hello, Solana from EVM!";
      
      // Convert text to hex if not already hex
      const hexData = messageData.startsWith("0x") 
        ? messageData 
        : "0x" + Buffer.from(messageData).toString("hex");

      this.logger.info(`Source Chain: ${sourceChain}`);
      this.logger.info(`Message Data: "${messageData}"`);
      this.logger.info(`Hex Encoded: ${hexData}`);

      // Prepare messaging options for utility functions
      const messagingOptions = {
        // No tokens for messaging
        tokenAmounts: [],
        
        // Fee configuration
        feeToken: this.options.feeToken || FeeTokenType.LINK,
        
        // Message configuration
        data: hexData,
        receiver: this.options.receiver || this.getDefaultReceiver(),
        
        // Token receiver - for arbitrary messages, this is usually the default PublicKey
        tokenReceiver: PublicKey.default.toString(),
        
        // Solana execution configuration
        // Higher compute units needed because message processing requires compute units
        computeUnits: this.options.computeUnits || 200000,
        allowOutOfOrderExecution: true,
        
        // ACCOUNT WRITABLE BITMAP EXPLANATION:
        // The accounts array below contains PDAs that the CCIP receiver program needs.
        // Each account can be either read-only or writable:
        //
        // Account List (in order):
        // Position 0: state PDA           - READ-ONLY  (stores program configuration)
        // Position 1: messagesStorage PDA - WRITABLE   (stores incoming CCIP messages)
        //
        // Bitmap Calculation:
        // - Each bit position corresponds to an account position in the array
        // - Bit = 0 means READ-ONLY, Bit = 1 means WRITABLE
        // - Position 0 (state): bit 0 = 0 (read-only)
        // - Position 1 (messagesStorage): bit 1 = 1 (writable)
        // - Binary: 10 (reading right to left: bit1=1, bit0=0)
        // - Decimal: 2 (binary 10 = decimal 2)
        accountIsWritableBitmap: BigInt(2), 
        
        // Accounts array - Program Derived Addresses (PDAs) for the CCIP receiver
        accounts: (() => {
          // Get the receiver program ID from config
          const receiverProgramId = getCCIPSVMConfig(
            ChainId.SOLANA_DEVNET
          ).receiverProgramId.toString();
          
          // Derive the PDAs using the same seeds as the Rust program
          const pdas = deriveReceiverPDAs(receiverProgramId);
          
          // Return accounts in the order that matches the bitmap above
          return [
            pdas.state.toString(),           // Position 0: READ-ONLY  (bit 0 = 0)
            pdas.messagesStorage.toString()  // Position 1: WRITABLE   (bit 1 = 1)
          ];
        })(),
        
        // Chain configuration
        chainId: sourceChain,
        
        // Logging and authentication
        logLevel: this.options.logLevel,
        privateKey: this.options.privateKey,
      };

      this.logger.info(`Fee Token: ${messagingOptions.feeToken}`);
      this.logger.info(`Receiver: ${messagingOptions.receiver}`);
      this.logger.info(`Compute Units: ${messagingOptions.computeUnits}`);
      
      // Log detailed Solana configuration before encoding
      this.logger.info("\n📋 Solana Configuration");
      this.logger.info("=========================================");
      this.logger.info(`Allow Out-of-Order Execution: ${messagingOptions.allowOutOfOrderExecution}`);
      this.logger.info(`Account Writable Bitmap: ${messagingOptions.accountIsWritableBitmap} (binary: ${messagingOptions.accountIsWritableBitmap.toString(2)})`);
      
      if (messagingOptions.accounts && messagingOptions.accounts.length > 0) {
        this.logger.info(`Solana Accounts (${messagingOptions.accounts.length}):`);
        messagingOptions.accounts.forEach((account, index) => {
          const isWritable = (messagingOptions.accountIsWritableBitmap & (BigInt(1) << BigInt(index))) !== BigInt(0);
          this.logger.info(`  ${index}: ${account} (${isWritable ? 'WRITABLE' : 'READ-ONLY'})`);
        });
      } else {
        this.logger.info("No additional Solana accounts specified");
      }
      
      // Log token receiver info
      if (messagingOptions.tokenReceiver) {
        this.logger.debug(`Token Receiver: ${messagingOptions.tokenReceiver}`);
      }

      // Set up client context
      const context = await setupClientContext(messagingOptions, "arbitrary-messaging");
      
      // Update logger to use the properly configured one from context
      this.logger = context.logger;

      const { client, config, signerAddress } = context;

      this.logger.info("\n📋 Message Summary");
      this.logger.info("=========================================");

      // Create CCIP message request
      const messageRequest = createCCIPMessageRequest(config, messagingOptions, this.logger);

      // Display message summary
      displayTransferSummary(
        config,
        messagingOptions,
        messageRequest,
        {
          symbol: "MESSAGE", // No token, so use "MESSAGE"
          decimals: 0,
        },
        this.logger,
        signerAddress
      );

      this.logger.info("\n🚀 Sending Message");
      this.logger.info("=========================================");
      this.logger.info("Sending CCIP message...");

      // Execute the message send
      const result = await client.sendCCIPMessage(messageRequest);

      this.logger.info("\n🎉 Message Results");
      this.logger.info("=========================================");

      // Display results
      displayTransferResults(result, config, this.logger);

      this.logger.info("\n✅ Message Sent Successfully!");
      this.logger.info("📬 Your message is being delivered to Solana");

    } catch (error) {
      this.logger.error(
        `❌ Message sending failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command when executed directly
if (require.main === module) {
  const command = new ArbitraryMessagingCommand();
  command.run().catch((error) => {
    process.exit(1);
  });
}

export { ArbitraryMessagingCommand };