import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createLogger, LogLevel } from "../../../ccip-lib/svm";
import { getCCIPSVMConfig, ChainId } from "../../config";
import { loadKeypair, loadReceiverProgram } from "../utils";
import { KEYPAIR_PATHS } from "../utils/config-parser";

/**
 * Closes the CCIP Basic Receiver messages storage account.
 * Sends the rent lamports back to the owner (payer).
 * 
 * This is useful for resetting the storage account if its size needs to change.
 * After running this, you MUST run the initialize script again.
 */

// ========== CONFIGURATION ==========
// The address of the CCIP Receiver program
const CUSTOM_PROGRAM_ID = null; // Set to null to use default from config

// Path to the owner's keypair (must match the owner set during initialization)
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || KEYPAIR_PATHS.DEFAULT;
// ========== END CONFIGURATION ==========

async function main() {
  // Create logger
  const logger = createLogger("ccip-receiver-close-storage", { level: LogLevel.INFO });
  logger.info("Attempting to close CCIP Basic Receiver messages storage account...");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  
  // Get program ID
  const programId = CUSTOM_PROGRAM_ID ? new PublicKey(CUSTOM_PROGRAM_ID) : config.receiverProgramId;
  logger.info(`Program ID: ${programId.toString()}`);

  logger.info(`Loading owner keypair from ${KEYPAIR_PATH}...`);

  try {
    // Load owner keypair
    const ownerKeypair = loadKeypair(KEYPAIR_PATH);
    logger.info(`Owner public key: ${ownerKeypair.publicKey.toString()}`);

    // Load the receiver program
    const { program } = loadReceiverProgram(KEYPAIR_PATH, config.connection, programId);
    
    try {
      // Find PDAs
      const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        programId
      );
      const [messagesStoragePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("messages_storage")],
        programId
      );
      
      logger.info(`State PDA: ${statePda.toString()}`);
      logger.info(`Messages Storage PDA: ${messagesStoragePda.toString()}`);
      
      // Check if messages storage account exists
      const messagesStorageInfo = await program.provider.connection.getAccountInfo(messagesStoragePda);
      if (messagesStorageInfo === null) {
        logger.info("Messages storage account does not exist or has already been closed.");
        process.exit(0);
      }

      logger.info("Found messages storage account. Attempting to close...");
        
      // Execute the close_storage instruction
      const tx = await program.methods
        .closeStorage()
        .accounts({
          state: statePda,
          messagesStorage: messagesStoragePda,
          owner: ownerKeypair.publicKey,
        })
        // Sign with the owner's keypair
        .signers([ownerKeypair]) 
        .rpc();
      
      logger.info(`Messages storage account closed successfully. Transaction: ${tx}`);
      logger.info(`Solana Explorer: ${config.explorerUrl}${tx}`);
      logger.info("\n======== IMPORTANT ========");
      logger.info("You MUST run the initialize script again before the receiver can function.");
      logger.info("Run: yarn svm:receiver:initialize");
      
    } catch (error) {
      logger.error("Error during closing process:", error);
      if (error instanceof Error && error.message.includes("Owner does not match")) {
         logger.error("Ensure the keypair used matches the owner set during initialization.");
      }
      process.exit(1);
    }
  } catch (error) {
    logger.error("Error loading keypair:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Closing failed:", error);
  process.exit(1);
}); 