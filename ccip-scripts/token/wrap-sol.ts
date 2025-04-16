import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
  getAssociatedTokenAddress
} from "@solana/spl-token";
import { loadKeypair, KEYPAIR_PATHS, parseTokenArgs, printUsage } from "../utils";

/**
 * Wraps SOL to wSOL
 */
async function wrapSol() {
  try {
    // Parse command line arguments
    const options = parseTokenArgs();
    const amountSol = options.amount || 1; // Default to 1 SOL if not specified
    
    console.log(`==== Wrapping ${amountSol} SOL to wSOL ====`);
    
    // Load the keypair
    const keypairPath = options.keypairPath || KEYPAIR_PATHS.TEST;
    console.log("Keypair Path:", keypairPath);
    
    const walletKeypair = loadKeypair(keypairPath);
    console.log("Wallet Public Key:", walletKeypair.publicKey.toString());
    
    // Create a connection to the appropriate network
    const network = options.network || "devnet";
    const connection = new Connection(`https://api.${network}.solana.com`, "confirmed");
    console.log(`Network: ${network}`);
    
    // Check SOL balance
    const solBalance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    
    if (solBalance < amountSol * LAMPORTS_PER_SOL) {
      console.error(`Error: Not enough SOL. Need at least ${amountSol} SOL.`);
      return;
    }
    
    // Get the associated token account for native SOL
    const wsolAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      walletKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    console.log("wSOL Account:", wsolAccount.toString());
    
    try {
      // Check if the token account exists
      const accountInfo = await connection.getAccountInfo(wsolAccount);
      
      if (!accountInfo) {
        console.log("Token account does not exist. Cannot wrap SOL.");
        return;
      }
      
      console.log("wSOL account exists. Proceeding with wrapping...");
      
      // Create a transaction to transfer SOL and sync native
      const transaction = new Transaction()
        .add(
          // Transfer SOL to the associated token account
          SystemProgram.transfer({
            fromPubkey: walletKeypair.publicKey,
            toPubkey: wsolAccount,
            lamports: amountSol * LAMPORTS_PER_SOL
          })
        )
        .add(
          // Sync native instruction to update token account balance
          createSyncNativeInstruction(wsolAccount)
        );
      
      // Send the transaction
      console.log("Sending transaction...");
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [walletKeypair],
        { skipPreflight: options.skipPreflight }
      );
      
      console.log(`✅ Transaction successful!`);
      console.log(`SOL wrapped to wSOL: ${amountSol} SOL`);
      console.log(`Transaction signature: ${signature}`);
      console.log(`Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=${network}`);
      
      // Get updated wSOL balance
      const tokenInfo = await connection.getTokenAccountBalance(wsolAccount);
      console.log(`New wSOL balance: ${tokenInfo.value.uiAmount} wSOL`);
      
    } catch (error) {
      console.error("Error wrapping SOL:", error instanceof Error ? error.message : String(error));
      
      if (error instanceof Error && error.stack) {
        console.log("Error stack:");
        console.log(error.stack);
      }
    }
  } catch (error) {
    console.error("Failed to execute wrap-sol:", error);
    printUsage("token:wrap");
  }
}

// Run the script
if (require.main === module) {
  wrapSol().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
} 