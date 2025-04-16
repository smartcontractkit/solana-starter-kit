import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  NATIVE_MINT,
} from "@solana/spl-token";
import { 
  loadKeypair,
  parseCommonArgs,
  printUsage,
  getKeypairPath
} from "../utils";
import { getCCIPConfig } from "../config/index";

/**
 * Status information for a token account's approvals
 */
interface TokenApprovalStatus {
  mint: PublicKey;
  tokenAccount: PublicKey;
  balance: string;
  delegate: PublicKey | null;
  delegatedAmount: string;
  hasDelegate: boolean;
}

/**
 * Check token approvals for a list of token mints
 * 
 * @param mints List of token mint addresses to check
 * @param delegateToCheck Optional delegate address to check against
 * @returns List of token approval statuses
 */
async function checkTokenApprovals(
  mints: string[],
  delegateToCheck?: string
): Promise<TokenApprovalStatus[]> {
  try {
    // Parse command line arguments
    const options = parseCommonArgs();
    const network = options.network || "devnet";
    
    console.log("\n==== Token Approval Status ====");
    console.log(`Network: ${network}`);
    
    // Load the keypair using the appropriate path
    const keypairPath = getKeypairPath(options);
    console.log("Keypair Path:", keypairPath);
    
    const walletKeypair = loadKeypair(keypairPath);
    console.log("Wallet Public Key:", walletKeypair.publicKey.toString());
    
    // Get the configuration for this network
    const config = getCCIPConfig(network);
    const connection = config.connection;
    
    // Custom token program mapping based on configuration
    const TOKEN_PROGRAM_MAPPING: Record<string, PublicKey> = {
      // Using token mints from the configuration
      [config.tokenMint.toString()]: TOKEN_2022_PROGRAM_ID,
      [config.linkTokenMint.toString()]: TOKEN_2022_PROGRAM_ID,
      // Default for wrapped SOL
      [NATIVE_MINT.toString()]: TOKEN_PROGRAM_ID,
    };
    
    console.log("\n==== Checking Token Accounts ====");
    console.log("Using default Token Program ID:", TOKEN_PROGRAM_ID.toString());
    console.log("Using Token 2022 Program ID:", TOKEN_2022_PROGRAM_ID.toString());
    console.log(
      "Using Associated Token Program ID:",
      ASSOCIATED_TOKEN_PROGRAM_ID.toString()
    );
    
    const results: TokenApprovalStatus[] = [];
    
    // Process each mint
    for (const mintAddress of mints) {
      try {
        const mint = new PublicKey(mintAddress);
        
        // Get the token program ID for this mint
        const tokenProgramId =
          TOKEN_PROGRAM_MAPPING[mintAddress] || TOKEN_PROGRAM_ID;
        
        console.log(`\nProcessing Mint: ${mint.toString()}`);
        console.log(`- Using Token Program: ${tokenProgramId.toString()}`);
        
        // Get the Associated Token Account (ATA) for this wallet and mint
        const tokenAccount = await getAssociatedTokenAddress(
          mint,
          walletKeypair.publicKey,
          false, // allowOwnerOffCurve
          tokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        console.log(`- Token Account: ${tokenAccount.toString()}`);
        
        try {
          // Fetch the token account data using the specific token program
          const tokenAccountInfo = await getAccount(
            connection,
            tokenAccount,
            connection.commitment,
            tokenProgramId
          );
          
          // Extract relevant information
          const delegateAddress = tokenAccountInfo.delegate;
          const delegatedAmount = tokenAccountInfo.delegatedAmount;
          const balance = tokenAccountInfo.amount;
          
          // Check if the delegate matches the one we're looking for (if specified)
          let matchesRequestedDelegate = true;
          if (delegateToCheck && delegateAddress) {
            const requestedDelegate = new PublicKey(delegateToCheck);
            matchesRequestedDelegate = delegateAddress.equals(requestedDelegate);
          }
          
          // Log info
          console.log(`- Balance: ${balance.toString()}`);
          
          if (delegateAddress !== null) {
            console.log(`- Delegate: ${delegateAddress.toString()}`);
            console.log(`- Delegated Amount: ${delegatedAmount.toString()}`);
            
            if (delegateToCheck) {
              console.log(
                `- Matches Requested Delegate: ${
                  matchesRequestedDelegate ? "Yes" : "No"
                }`
              );
            }
          } else {
            console.log("- No delegate set for this token account");
          }
          
          // Store result
          results.push({
            mint,
            tokenAccount,
            balance: balance.toString(),
            delegate: delegateAddress,
            delegatedAmount: delegatedAmount.toString(),
            hasDelegate: delegateAddress !== null,
          });
        } catch (error) {
          console.log(`- Error fetching token account: Account may not exist`);
          
          // Store result for non-existent accounts
          results.push({
            mint,
            tokenAccount,
            balance: "0",
            delegate: null,
            delegatedAmount: "0",
            hasDelegate: false,
          });
        }
      } catch (error) {
        console.error(`Error processing mint ${mintAddress}:`, error);
      }
    }
    
    // Print summary table
    console.log("\n==== Summary ====");
    console.log("Mint | Token Account | Balance | Delegate | Delegated Amount");
    console.log("-----|--------------|---------|----------|-----------------");
    
    for (const result of results) {
      console.log(
        `${result.mint.toString().slice(0, 8)}... | ` +
          `${result.tokenAccount.toString().slice(0, 8)}... | ` +
          `${result.balance} | ` +
          `${
            result.delegate
              ? result.delegate.toString().slice(0, 8) + "..."
              : "None"
          } | ` +
          `${result.delegatedAmount}`
      );
    }
    
    return results;
  } catch (error) {
    console.error("Error checking token approvals:", error);
    printUsage("token:check");
    return [];
  }
}

/**
 * Main entry point for the token approval checker
 */
async function main() {
  try {
    // Parse command line arguments
    const options = parseCommonArgs();
    const network = options.network || "devnet";
    
    // Get the config for token mints
    const config = getCCIPConfig(network);
    
    // List of mints to check from config and constants
    const mintsToCheck = [
      NATIVE_MINT.toString(), // Wrapped SOL
      config.tokenMint.toString(), // BnM token
      config.linkTokenMint.toString(), // LINK token
    ];
    
    // Optional: Specific delegate to check against
    // const delegateToCheck = "YourDelegateAddressHere";
    
    console.log(`Running checks on ${network} network`);
    
    // Run the check
    await checkTokenApprovals(mintsToCheck);
    
    console.log("\nToken approval check completed successfully");
  } catch (error) {
    console.error("Error in main function:", error);
    printUsage("token:check");
    process.exit(1);
  }
}

// Run the script if it's executed directly
if (require.main === module) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
