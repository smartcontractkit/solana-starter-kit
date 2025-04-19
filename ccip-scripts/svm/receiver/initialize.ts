import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createLogger, LogLevel } from "../../../ccip-lib/svm";
import { getCCIPSVMConfig, ChainId } from "../../config";
import { loadKeypair, loadReceiverProgram } from "../utils";
import { KEYPAIR_PATHS } from "../utils/config-parser";

/**
 * Initializes the CCIP Basic Receiver program on Solana.
 * Sets up the program state for CCIP message reception.
 * 
 * To use this script with a different setup, modify the CONFIGURATION section below.
 */

// ========== CONFIGURATION ==========
// The address of the CCIP Receiver program to initialize
// By default uses the program ID from config, change this value to use a custom program ID
const CUSTOM_PROGRAM_ID = null; // Set to null to use default from config, or specify a custom program ID string

// Path to your wallet keypair
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || KEYPAIR_PATHS.DEFAULT;
// ========== END CONFIGURATION ==========

async function main() {
  // Create logger
  const logger = createLogger("ccip-receiver-initialize", { level: LogLevel.INFO });
  logger.info("CCIP Basic Receiver Initialization");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  
  // Get program ID from config or use custom one if specified
  const programId = CUSTOM_PROGRAM_ID ? new PublicKey(CUSTOM_PROGRAM_ID) : config.receiverProgramId;
  logger.info(`Program ID: ${programId.toString()}`);

  logger.info(`Loading keypair from ${KEYPAIR_PATH}...`);

  try {
    // Load keypair and check balance
    const walletKeypair = loadKeypair(KEYPAIR_PATH);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Check account balance
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    logger.info(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      logger.warn("Warning: Low balance. Might not be enough for initialization.");
      logger.warn("Request airdrop from Solana devnet faucet before proceeding.");
      logger.info("You can request an airdrop with:");
      logger.info(`solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`);
      process.exit(1);
    }

    // Load the receiver program using our utility function
    const { program } = loadReceiverProgram(KEYPAIR_PATH, config.connection, programId);
    
    try {
      // Find the state PDA
      const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        programId
      );
      
      logger.info(`State PDA: ${statePda.toString()}`);
      
      // Find the messages storage PDA
      const [messagesStoragePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("messages_storage")],
        programId
      );
      
      logger.info(`Messages Storage PDA: ${messagesStoragePda.toString()}`);
      
      // Check if state is already initialized
      let isStateInitialized = false;
      try {
        const stateAccountInfo = await program.provider.connection.getAccountInfo(statePda);
        if (stateAccountInfo !== null && stateAccountInfo.data.length > 0) {
          isStateInitialized = true;
          logger.info("State is already initialized");
        }
      } catch (error) {
        logger.info("Error checking state account:", error);
      }
      
      // Initialize state if not already initialized
      if (!isStateInitialized) {
        logger.info("Initializing program state...");
        logger.info(`Router Program ID: ${config.routerProgramId.toString()}`);
        
        try {
          const tx = await program.methods
            .initialize(config.routerProgramId)
            .accounts({
              payer: program.provider.publicKey,
              state: statePda,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
          
          logger.info(`Program initialized successfully. Transaction: ${tx}`);
          logger.info(`Solana Explorer: ${config.explorerUrl}${tx}`);
        } catch (error) {
          logger.error("Error initializing program state:", error);
          process.exit(1);
        }
      }
      
      logger.info("Initialization process completed");
      logger.info("\n======== NEXT STEPS ========");
      logger.info("To receive tokens, initialize token vaults using:");
      logger.info("npx ts-node ccip-scripts/svm/receiver/initialize-vault.ts");
      
    } catch (error) {
      logger.error("Error during initialization:", error);
      process.exit(1);
    }
  } catch (error) {
    logger.error("Error loading keypair:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Initialization failed:", error);
  process.exit(1);
}); 