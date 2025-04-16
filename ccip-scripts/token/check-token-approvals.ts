import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  NATIVE_MINT,
} from "@solana/spl-token";
import * as utils from "../utils/index";
import { getCCIPConfig } from "../config/index";
import * as path from "path";

// Default network to use
const DEFAULT_NETWORK = "devnet" as const;
type NetworkType = "devnet" | "mainnet";

// Test keypath for development purposes
const TEST_KEYPAIR_PATH = path.resolve(
  process.env.KEYPAIR_PATH || 
  path.join(process.env.HOME || "", ".config/solana/keytest.json")
);

// Get the config to use for initializing token mappings
const devnetConfig = getCCIPConfig(DEFAULT_NETWORK);

// Custom token program mapping based on configuration
const TOKEN_PROGRAM_MAPPING: Record<string, PublicKey> = {
  // Using token mints from the configuration
  [devnetConfig.tokenMint.toString()]: TOKEN_2022_PROGRAM_ID,
  [devnetConfig.linkTokenMint.toString()]: TOKEN_2022_PROGRAM_ID,
  // Default for wrapped SOL
  [NATIVE_MINT.toString()]: TOKEN_PROGRAM_ID,
};

interface TokenApprovalStatus {
  mint: PublicKey;
  tokenAccount: PublicKey;
  balance: string;
  delegate: PublicKey | null;
  delegatedAmount: string;
  hasDelegate: boolean;
}

async function checkTokenApprovals(
  mints: string[],
  delegateToCheck?: string,
  networkOverride?: NetworkType
) {
  console.log("\n==== Token Approval Status ====");

  // Load the keypair and setup the provider
  const keypairPath = TEST_KEYPAIR_PATH;
  console.log("Keypair Path:", keypairPath);

  const walletKeypair = utils.loadKeypair(keypairPath);
  console.log("Wallet Public Key:", walletKeypair.publicKey.toString());

  // Get the configuration
  const network = networkOverride || DEFAULT_NETWORK;
  console.log("Network:", network);

  const config = getCCIPConfig(network);
  const connection = config.connection;

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
}

async function main() {
  try {
    // Get the config for token mints
    const config = getCCIPConfig(DEFAULT_NETWORK);

    // List of mints to check from config and constants
    const mintsToCheck = [
      NATIVE_MINT.toString(), // Wrapped SOL
      config.tokenMint.toString(), // BnM token
      config.linkTokenMint.toString(), // LINK token
    ];

    // Optional: Specific delegate to check against
    // const delegateToCheck = "YourDelegateAddressHere";

    console.log(`Running checks on ${DEFAULT_NETWORK} network`);

    // Run the check
    await checkTokenApprovals(mintsToCheck, undefined, DEFAULT_NETWORK);

    console.log("\nToken approval check completed successfully");
  } catch (error) {
    console.error("Error in main function:", error);
    process.exit(1);
  }
}

// Run the script
main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
