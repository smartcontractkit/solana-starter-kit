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
      
      // Find the token admin PDA
      const [tokenAdminPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_admin")],
        programId
      );
      
      logger.info(`Token Admin PDA: ${tokenAdminPda.toString()}`);
      
      // Check if state and messages storage are already initialized
      let isStateInitialized = false;
      let isMessagesStorageInitialized = false;
      let isTokenAdminInitialized = false;
      
      try {
        const stateAccountInfo = await program.provider.connection.getAccountInfo(statePda);
        if (stateAccountInfo !== null && stateAccountInfo.data.length > 0) {
          isStateInitialized = true;
          logger.info("State is already initialized");
        }
        
        const messagesStorageInfo = await program.provider.connection.getAccountInfo(messagesStoragePda);
        if (messagesStorageInfo !== null && messagesStorageInfo.data.length > 0) {
          isMessagesStorageInitialized = true;
          logger.info("Messages storage is already initialized");
        }
        
        const tokenAdminInfo = await program.provider.connection.getAccountInfo(tokenAdminPda);
        if (tokenAdminInfo !== null && tokenAdminInfo.data.length > 0) {
          isTokenAdminInitialized = true;
          logger.info("Token admin is already initialized");
        }
      } catch (error) {
        logger.info("Error checking accounts:", error);
      }
      
      // Initialize if any required account is not initialized
      // With init_if_needed, this will be safe even if some accounts are already initialized
      if (!isStateInitialized || !isMessagesStorageInitialized || !isTokenAdminInitialized) {
        logger.info("Initializing program accounts...");
        logger.info(`Router Program ID: ${config.routerProgramId.toString()}`);
        
        try {
          const tx = await program.methods
            .initialize(config.routerProgramId)
            .accounts({
              payer: program.provider.publicKey,
              state: statePda,
              messagesStorage: messagesStoragePda,
              tokenAdmin: tokenAdminPda,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
          
          logger.info(`Program initialized successfully. Transaction: ${tx}`);
          logger.info(`Solana Explorer: ${config.explorerUrl}${tx}`);
        } catch (error) {
          logger.error("Error initializing program:", error);
          process.exit(1);
        }
      } else {
        logger.info("All program accounts are already initialized");
      }
      
      logger.info("Initialization process completed");
      logger.info("\n======== NEXT STEPS ========");
      logger.info("The program is ready to receive CCIP messages and tokens");
      logger.info("No additional initialization is needed as tokens are processed dynamically");
      
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