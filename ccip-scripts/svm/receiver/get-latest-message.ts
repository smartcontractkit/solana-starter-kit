import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createLogger, LogLevel } from "../../../ccip-lib/svm";
import { getCCIPSVMConfig, ChainId } from "../../config";
import { loadKeypair, loadReceiverProgram } from "../utils";
import { KEYPAIR_PATHS } from "../utils/config-parser";

/**
 * Fetches the latest message received by the CCIP Basic Receiver program on Solana.
 * 
 * This script calls the get_latest_message instruction and displays the message details.
 * 
 * To use this script with a different setup, modify the CONFIGURATION section below.
 */

// ========== CONFIGURATION ==========
// The address of the CCIP Receiver program to query
// By default uses the program ID from config, change this value to use a custom program ID
const CUSTOM_PROGRAM_ID = null; // Set to null to use default from config, or specify a custom program ID string

// Path to your wallet keypair
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || KEYPAIR_PATHS.DEFAULT;
// ========== END CONFIGURATION ==========

async function main() {
  // Create logger
  const logger = createLogger("ccip-receiver-get-latest-message", { level: LogLevel.INFO });
  logger.info("CCIP Basic Receiver - Get Latest Message");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  
  // Get program ID from config or use custom one if specified
  const programId = CUSTOM_PROGRAM_ID ? new PublicKey(CUSTOM_PROGRAM_ID) : config.receiverProgramId;
  logger.info(`Program ID: ${programId.toString()}`);

  logger.info(`Loading keypair from ${KEYPAIR_PATH}...`);

  try {
    // Load keypair
    const walletKeypair = loadKeypair(KEYPAIR_PATH);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Load the receiver program using our utility function
    const { program } = loadReceiverProgram(KEYPAIR_PATH, config.connection, programId);
    
    try {
      // Find the messages storage PDA
      const [messagesStoragePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("messages_storage")],
        programId
      );
      
      logger.info(`Messages Storage PDA: ${messagesStoragePda.toString()}`);
      
      // Check if messages storage is initialized
      try {
        const msgStorageAccountInfo = await program.provider.connection.getAccountInfo(messagesStoragePda);
        if (msgStorageAccountInfo === null || msgStorageAccountInfo.data.length === 0) {
          logger.error("Messages storage is not initialized. You need to receive a message first.");
          process.exit(1);
        }
      } catch (error) {
        logger.error("Error checking messages storage account:", error);
        process.exit(1);
      }
      
      // Call the get_latest_message instruction
      logger.info("Fetching latest message...");
      
      try {
        const latestMessage = await program.methods
          .getLatestMessage()
          .accounts({
            messagesStorage: messagesStoragePda,
          })
          .view();
        
        // Check if message exists
        if (!latestMessage || !latestMessage.messageId) {
          logger.info("No messages have been received yet");
          process.exit(0);
        }
        
        // Format and display message information
        logger.info("\n======== LATEST MESSAGE ========");
        logger.info(`Message ID: 0x${Buffer.from(latestMessage.messageId).toString('hex')}`);
        logger.info(`Source Chain Selector: ${latestMessage.sourceChainSelector.toString()}`);
        logger.info(`Sender: 0x${Buffer.from(latestMessage.sender).toString('hex')}`);
        logger.info(`Message Type: ${getMessageTypeName(latestMessage.messageType)}`);
        logger.info(`Received Timestamp: ${new Date(latestMessage.receivedTimestamp * 1000).toISOString()}`);
        
        // Display data if present
        if (latestMessage.data && latestMessage.data.length > 0) {
          const dataHex = Buffer.from(latestMessage.data).toString('hex');
          logger.info(`Data (hex): 0x${dataHex}`);
          
          // Try to decode as UTF-8 text if possible
          try {
            const dataText = Buffer.from(latestMessage.data).toString('utf8');
            logger.info(`Data (text): ${dataText}`);
          } catch (error) {
            logger.info("Data could not be decoded as text");
          }
        } else {
          logger.info("No data in message");
        }
        
        // Display token information if present
        if (latestMessage.tokenAmounts && latestMessage.tokenAmounts.length > 0) {
          logger.info("\nToken Transfers:");
          for (let i = 0; i < latestMessage.tokenAmounts.length; i++) {
            const tokenAmount = latestMessage.tokenAmounts[i];
            logger.info(`  Token ${i+1}: ${tokenAmount.token.toString()}`);
            logger.info(`  Amount: ${tokenAmount.amount.toString()}`);
          }
        } else {
          logger.info("No tokens transferred in this message");
        }
        
      } catch (error) {
        logger.error("Error fetching latest message:", error);
        process.exit(1);
      }
      
    } catch (error) {
      logger.error("Error checking message storage:", error);
      process.exit(1);
    }
  } catch (error) {
    logger.error("Error loading keypair:", error);
    process.exit(1);
  }
}

// Helper function to convert message type enum to string
function getMessageTypeName(messageType: any): string {
  const types = {
    'tokenTransfer': 'Token Transfer',
    'arbitraryMessaging': 'Arbitrary Messaging',
    'programmaticTokenTransfer': 'Programmatic Token Transfer'
  };
  
  // Return the human-readable name or the raw value if not found
  return types[Object.keys(messageType)[0]] || 'Unknown';
}

main().catch((error) => {
  console.error("Get latest message failed:", error);
  process.exit(1);
}); 