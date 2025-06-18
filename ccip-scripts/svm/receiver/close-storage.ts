import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createLogger, LogLevel } from "../../../ccip-lib/svm";
import { getCCIPSVMConfig, ChainId } from "../../config";
import { loadKeypair, loadReceiverProgram } from "../utils";
import { KEYPAIR_PATHS } from "../utils/config-parser";

/**
 * Closes the CCIP Basic Receiver state and messages storage accounts.
 * Sends the rent lamports back to the owner (payer).
 * 
 * This is useful for resetting the program state if its size needs to change.
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
  logger.info("Attempting to close CCIP Basic Receiver state and messages storage accounts...");

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
      const [tokenAdminPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_admin")],
        programId
      );
      
      logger.info(`State PDA: ${statePda.toString()}`);
      logger.info(`Messages Storage PDA: ${messagesStoragePda.toString()}`);
      logger.info(`Token Admin PDA: ${tokenAdminPda.toString()} (will not be closed)`);
      
      // Check if accounts exist
      const stateInfo = await program.provider.connection.getAccountInfo(statePda);
      const messagesStorageInfo = await program.provider.connection.getAccountInfo(messagesStoragePda);
      const tokenAdminInfo = await program.provider.connection.getAccountInfo(tokenAdminPda);
      
      // Show current account states
      if (stateInfo === null) {
        logger.info("State account does not exist or has already been closed.");
      } else {
        logger.info(`State account exists (${stateInfo.data.length} bytes, ${stateInfo.lamports / LAMPORTS_PER_SOL} SOL)`);
      }
      
      if (messagesStorageInfo === null) {
        logger.info("Messages storage account does not exist or has already been closed.");
      } else {
        logger.info(`Messages storage account exists (${messagesStorageInfo.data.length} bytes, ${messagesStorageInfo.lamports / LAMPORTS_PER_SOL} SOL)`);
      }
      
      if (tokenAdminInfo === null) {
        logger.info("Token admin account does not exist.");
      } else {
        logger.info(`Token admin account exists (${tokenAdminInfo.data.length} bytes, ${tokenAdminInfo.lamports / LAMPORTS_PER_SOL} SOL)`);
        logger.info("Note: Token admin account will remain open after this operation.");
      }
      
      if (stateInfo === null && messagesStorageInfo === null) {
        logger.info("No accounts to close. All accounts are already closed.");
        process.exit(0);
      }
      
      logger.info("Found accounts to close. Attempting to close...");
      
      // Execute the close_storage instruction
      const tx = await program.methods
        .closeStorage()
        .accounts({
          state: statePda,
          messagesStorage: messagesStoragePda,
          owner: ownerKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerKeypair]) 
        .rpc();
      
      // Verify account closure
      const postStateInfo = await program.provider.connection.getAccountInfo(statePda);
      const postMessagesStorageInfo = await program.provider.connection.getAccountInfo(messagesStoragePda);
      
      if (postStateInfo === null) {
        logger.info("✅ State account successfully closed.");
      } else {
        logger.warn("⚠️ State account still exists after close operation!");
      }
      
      if (postMessagesStorageInfo === null) {
        logger.info("✅ Messages storage account successfully closed.");
      } else {
        logger.warn("⚠️ Messages storage account still exists after close operation!");
      }
      
      logger.info(`Transaction: ${tx}`);
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