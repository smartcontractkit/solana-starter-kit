import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createLogger, LogLevel } from "../../../ccip-lib/svm";
import { getCCIPSVMConfig, ChainId } from "../../config";
import { loadKeypair, loadReceiverProgram } from "../utils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

/**
 * Initializes a token vault for the CCIP Basic Receiver program on Solana.
 * This allows the program to receive specific tokens through CCIP.
 * 
 * To use this script with a different setup, modify the CONFIGURATION section below.
 */

// ========== CONFIGURATION ==========
// The address of the CCIP Receiver program
// By default uses the program ID from config, change this value to use a custom program ID
const CUSTOM_PROGRAM_ID = null; // Set to null to use default from config, or specify a custom program ID string

// The token mint to create a vault for
// By default uses the BnM token from config (config.tokenMint)
// Change to a specific PublicKey string to create a vault for a different token
const CUSTOM_TOKEN_MINT = null; // Set to null to use default BnM token, or specify a custom token mint

// Path to your wallet keypair
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || "~/.config/solana/id.json";
// ========== END CONFIGURATION ==========

async function main() {
  // Create logger
  const logger = createLogger("ccip-receiver-init-vault", { level: LogLevel.INFO });
  logger.info("CCIP Basic Receiver Token Vault Initialization");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  
  // Get program ID from config or use custom one if specified
  const programId = CUSTOM_PROGRAM_ID ? new PublicKey(CUSTOM_PROGRAM_ID) : config.receiverProgramId;
  logger.info(`Program ID: ${programId.toString()}`);
  
  // Get token mint (use custom if provided, otherwise use default from config)
  const tokenMint = CUSTOM_TOKEN_MINT ? new PublicKey(CUSTOM_TOKEN_MINT) : config.tokenMint;
  logger.info(`Token Mint: ${tokenMint.toString()}`);
  
  // Load keypair
  logger.info(`Loading keypair from ${KEYPAIR_PATH}...`);

  try {
    // Load keypair and check balance
    const walletKeypair = loadKeypair(KEYPAIR_PATH);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Check account balance
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    logger.info(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
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
      
      // Initialize token vault
      logger.info(`Initializing token vault for mint: ${tokenMint.toString()}`);
      
      // Derive the token vault authority PDA
      const [tokenVaultAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault")],
        programId
      );
      
      // Derive the token vault PDA
      const [tokenVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), tokenMint.toBuffer()],
        programId
      );
      
      logger.info(`Token Vault Authority PDA: ${tokenVaultAuthority.toString()}`);
      logger.info(`Token Vault PDA: ${tokenVault.toString()}`);
      
      // Check if token vault already exists
      try {
        const tokenAccountInfo = await program.provider.connection.getAccountInfo(tokenVault);
        if (tokenAccountInfo !== null) {
          logger.info("Token vault is already initialized");
        } else {
          try {
            const tx = await program.methods
              .initializeTokenVault()
              .accounts({
                payer: program.provider.publicKey,
                state: statePda,
                tokenMint: tokenMint,
                tokenVault: tokenVault,
                tokenVaultAuthority: tokenVaultAuthority,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
              })
              .rpc();
            
            logger.info(`Token vault initialized successfully. Transaction: ${tx}`);
            logger.info(`Solana Explorer: ${config.explorerUrl}${tx}`);
          } catch (error) {
            logger.error("Error initializing token vault:", error);
            process.exit(1);
          }
        }
      } catch (error) {
        logger.error("Error checking token vault:", error);
        process.exit(1);
      }
      
      logger.info("Token vault initialization completed");
      
    } catch (error) {
      logger.error("Error during token vault initialization:", error);
      process.exit(1);
    }
  } catch (error) {
    logger.error("Error loading keypair:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Token vault initialization failed:", error);
  process.exit(1);
}); 