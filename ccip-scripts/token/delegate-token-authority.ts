import {
  PublicKey,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createApproveInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
} from "@solana/spl-token";
import BN from "bn.js";
import * as utils from "../utils/index";
import { getCCIPConfig } from "../config/index";
import {
  findFeeBillingSignerPDA,
  findExternalTokenPoolsSignerPDA,
  findDynamicTokenPoolsSignerPDA,
} from "../../ccip-sdk/utils/pdas";
import * as path from "path";

// Default network to use
const DEFAULT_NETWORK = "devnet" as const;
type NetworkType = "devnet" | "mainnet";

// Test keypath for development purposes
const TEST_KEYPAIR_PATH = path.resolve(
  process.env.HOME || "",
  ".config/solana/keytest.json"
);

// Maximum uint64 value for unlimited approvals - computes 2^64 - 1
const MAX_UINT64 = ((BigInt(1) << BigInt(64)) - BigInt(1)).toString();

// Get the configuration to use for token mints
const config = getCCIPConfig(DEFAULT_NETWORK);

async function delegateTokenAuthority(networkOverride?: NetworkType) {
  // Load configuration
  console.log("==== Delegate Token Authority ====");

  // Use test keypair path for development
  const keypairPath = TEST_KEYPAIR_PATH;
  console.log("Keypair Path:", keypairPath);

  // Load wallet keypair
  const walletKeypair = utils.loadKeypair(keypairPath);
  console.log("Wallet public key:", walletKeypair.publicKey.toString());

  // Connect to Solana
  const network = networkOverride || DEFAULT_NETWORK;
  console.log("Network:", network);

  const connection = new Connection(
    network === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com",
    "confirmed"
  );

  // Get router program ID from config
  const routerProgramId = config.ccipRouterProgramId;
  console.log("Router Program ID:", routerProgramId.toString());

  // Derive static PDAs
  const [feeBillingSignerPDA] = findFeeBillingSignerPDA(routerProgramId);
  console.log("Fee Billing Signer PDA:", feeBillingSignerPDA.toString());

  // For BnM and LINK tokens, we need to dynamically find the token pool signers
  // First, prepare an array to hold our token delegations
  const tokenDelegations = [];

  // Add static delegation for wSOL (using fee billing signer)
  tokenDelegations.push({
    // Wrapped SOL (wSOL) - uses legacy TOKEN_PROGRAM_ID for fees
    mint: NATIVE_MINT.toString(),
    tokenProgramId: TOKEN_PROGRAM_ID.toString(),
    delegate: feeBillingSignerPDA.toString(),
    amount: MAX_UINT64, // Unlimited approval
  });

  try {
    // Dynamically determine the BnM token pool signer
    console.log("\nDetermining BnM token pool signer...");
    const bnmMint = new PublicKey(config.tokenMint.toString());
    const [bnmPoolSignerPDA] = await findDynamicTokenPoolsSignerPDA(
      bnmMint,
      routerProgramId,
      connection
    );
    console.log("BnM Token Pool Signer PDA:", bnmPoolSignerPDA.toString());

    // Add BnM token delegation with the correct PDA
    tokenDelegations.push({
      mint: config.tokenMint.toString(),
      tokenProgramId: TOKEN_2022_PROGRAM_ID.toString(),
      delegate: bnmPoolSignerPDA.toString(),
      amount: MAX_UINT64, // Unlimited approval
    });

    // Add LINK token delegation with the correct PDA
    tokenDelegations.push({
      mint: config.linkTokenMint.toString(),
      tokenProgramId: TOKEN_2022_PROGRAM_ID.toString(),
      delegate: feeBillingSignerPDA.toString(),
      amount: MAX_UINT64, // Unlimited approval
    });
  } catch (error) {
    console.error("Error determining dynamic token pool signers:", error);
    console.log("\nFalling back to static token pool signer...");

    // Fallback to the basic external token pools signer if dynamic lookup fails
    const [tokenPoolsSignerPDA] =
      findExternalTokenPoolsSignerPDA(routerProgramId);
    console.log(
      "Fallback Token Pools Signer PDA:",
      tokenPoolsSignerPDA.toString()
    );

    // Add BnM and LINK tokens with the fallback PDA
    tokenDelegations.push(
      {
        mint: config.tokenMint.toString(),
        tokenProgramId: TOKEN_2022_PROGRAM_ID.toString(),
        delegate: tokenPoolsSignerPDA.toString(),
        amount: MAX_UINT64, // Unlimited approval
      },
      {
        mint: config.linkTokenMint.toString(),
        tokenProgramId: TOKEN_2022_PROGRAM_ID.toString(),
        delegate: tokenPoolsSignerPDA.toString(),
        amount: MAX_UINT64, // Unlimited approval
      }
    );
  }

  // Process each token delegation
  console.log("\n==== Processing Token Delegations ====");

  for (let i = 0; i < tokenDelegations.length; i++) {
    const delegation = tokenDelegations[i];
    console.log(
      `\n[${i + 1}/${
        tokenDelegations.length
      }] Processing delegation for mint: ${delegation.mint}`
    );

    try {
      const tokenMint = new PublicKey(delegation.mint);
      const tokenProgramId = new PublicKey(delegation.tokenProgramId);
      const delegateAddress = new PublicKey(delegation.delegate);
      const amountToDelegate = new BN(delegation.amount);

      console.log("Token Program ID:", tokenProgramId.toString());
      console.log("Delegate Address:", delegateAddress.toString());
      console.log("Amount to delegate:", amountToDelegate.toString());

      // Get the user's token account
      const userTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        walletKeypair.publicKey,
        false,
        tokenProgramId
      );

      console.log("User Token Account:", userTokenAccount.toString());

      // Create the approve instruction
      const approveInstruction = createApproveInstruction(
        userTokenAccount,
        delegateAddress,
        walletKeypair.publicKey,
        BigInt(amountToDelegate.toString()),
        [],
        tokenProgramId
      );

      // Create and send transaction
      const transaction = new Transaction().add(approveInstruction);

      console.log("Sending transaction to delegate token authority...");
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [walletKeypair]
      );

      console.log(`✅ Token delegation successful!`);
      console.log(`Transaction signature: ${signature}`);
      console.log(
        `Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=${network}`
      );
    } catch (error) {
      console.error(
        `❌ Error delegating token authority:`,
        error instanceof Error ? error.message : String(error)
      );

      if (error instanceof Error && error.stack) {
        console.log("\nError stack:");
        console.log(error.stack);
      }
    }
  }

  console.log("\n==== All delegations processed ====");
}

// Run the script
delegateTokenAuthority().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
