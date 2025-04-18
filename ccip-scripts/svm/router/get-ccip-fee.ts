import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

// Import from SDK for model types and logger
import {
  CCIPFeeRequest,
  LogLevel,
  AddressConversion,
} from "../../../ccip-lib/svm";

// Import from centralized config
import { 
  ChainId, 
  CHAIN_SELECTORS,
  getCCIPSVMConfig
} from "../../config";

// Import our local utilities
import {
  loadKeypair,
  parseCommonArgs,
  printUsage,
  getKeypairPath,
} from "../utils";
import { createCCIPClient } from "../utils/client-factory";

async function getRouterFee() {
  try {
    // Parse command line arguments
    const options = parseCommonArgs();
    const network = options.network || "devnet";

    // Use the appropriate keypair path
    console.log("\n==== Environment Information ====");
    console.log(`Solana Cluster: ${network}`);

    const keypairPath = getKeypairPath(options);
    console.log("Keypair Path:", keypairPath);
    console.log("Log Level:", LogLevel[options.logLevel ?? LogLevel.INFO]);
    console.log("Skip Preflight:", options.skipPreflight ? "Yes" : "No");

    // Load the wallet keypair
    const walletKeypair = loadKeypair(keypairPath);
    console.log("Wallet Public Key:", walletKeypair.publicKey.toString());

    // Get the configuration
    const chainId = ChainId.SOLANA_DEVNET; // Map network string to ChainId
    const config = getCCIPSVMConfig(chainId);

    // Create the CCIPClient with our factory
    const ccipClient = createCCIPClient({
      keypairPath,
      logLevel: options.logLevel,
      skipPreflight: options.skipPreflight,
    });

    // Check wallet balance
    console.log("\n==== Wallet Balance Information ====");
    const connection = config.connection;
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log("SOL Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    console.log("Lamports Balance:", balance, "lamports");

    // Log minimum rent exemption
    const minRentExemption = await connection.getMinimumBalanceForRentExemption(
      0
    );
    console.log(
      "Minimum Rent Exemption:",
      minRentExemption / LAMPORTS_PER_SOL,
      "SOL"
    );

    // Get network fees
    try {
      // Create a simple message to estimate fees
      const { blockhash } = await connection.getLatestBlockhash();
      const message = new anchor.web3.TransactionMessage({
        payerKey: walletKeypair.publicKey,
        recentBlockhash: blockhash,
        instructions: [], // Empty instructions for base fee
      }).compileToV0Message();

      const fee = await connection.getFeeForMessage(message);
      console.log(
        "Estimated Transaction Fee:",
        fee.value || "Unknown",
        "lamports"
      );
    } catch (error) {
      console.log(
        "Could not estimate transaction fee:",
        error instanceof Error ? error.message : String(error)
      );
    }

    console.log("\n==== CCIP Router Information ====");
    console.log(
      "CCIP Router Program ID:",
      config.routerProgramId.toString()
    );
    console.log("Fee Quoter Program ID:", config.feeQuoterProgramId.toString());
    console.log("RMN Remote Program ID:", config.rmnRemoteProgramId.toString());

    console.log("\n==== Message Parameters ====");

    // Create a message for fee calculation - using the parameters specified
    const EVM_RECEIVER = "0x9d087fC03ae39b088326b67fA3C788236645b717";
    const TOKEN_AMOUNT = 0.01; // 0.01 tokens with 9 decimals
    const TOKEN_DECIMALS = 9;

    console.log("- Receiver (EVM):", EVM_RECEIVER);
    console.log("- Data: Empty (token transfer only)");
    console.log("- Token Amount:", TOKEN_AMOUNT, "tokens");
    console.log("- Token Decimals:", TOKEN_DECIMALS);
    console.log("- Fee Token:", NATIVE_MINT.toString(), "(Wrapped SOL)");

    // Convert the EVM address to the format expected by Solana
    const receiverBytes =
      AddressConversion.evmAddressToSolanaBytes(EVM_RECEIVER);

    // Convert amount to on-chain representation with proper decimals
    const onChainAmount = new anchor.BN(
      TOKEN_AMOUNT * Math.pow(10, TOKEN_DECIMALS)
    );

    // Use wrapped SOL as fee token
    const feeToken = NATIVE_MINT;

    // Define destination chain selector (Ethereum Sepolia)
    const destChainSelector = CHAIN_SELECTORS[ChainId.ETHEREUM_SEPOLIA];

    // Create the CCIPFeeRequest using values from config
    const feeRequest: CCIPFeeRequest = {
      destChainSelector: new anchor.BN(destChainSelector.toString()),
      message: {
        receiver: receiverBytes,
        data: Buffer.alloc(0), // Empty data for token transfer only
        tokenAmounts: [
          {
            token: config.tokenMint,
            amount: onChainAmount,
          },
        ],
        feeToken: feeToken,
        extraArgs: Buffer.alloc(0), // Empty extra args
      },
    };

    console.log("\n==== Message Details ====");
    console.log(
      "- Receiver (bytes):",
      Buffer.from(receiverBytes).toString("hex")
    );
    console.log("- On-chain amount:", onChainAmount.toString());
    console.log("- Token mint:", config.tokenMint.toString());
    console.log("- Fee token:", feeToken.toString());
    console.log(
      "- Destination chain selector:",
      destChainSelector.toString()
    );

    // Add detailed debug logging
    console.log("\n==== Debug Information ====");
    console.log(
      "- Fee token type:",
      feeToken.equals(PublicKey.default)
        ? "PublicKey.default"
        : "Custom PublicKey"
    );
    console.log("- PublicKey.default value:", PublicKey.default.toString());
    console.log("- NATIVE_MINT value:", NATIVE_MINT.toString());

    console.log("\n==== Calling getFee ====");
    try {
      // Call getFee with the CCIPClient
      console.log("Preparing fee request...");
      const feeResult = await ccipClient.getFee(feeRequest);

      console.log("\nFee Result Details:");
      console.log("------------------");

      // Format fee amount based on token type
      const feeToken = new PublicKey(feeResult.token);
      let formattedFee: string;

      if (feeToken.equals(NATIVE_MINT)) {
        formattedFee = `${feeResult.amount.toNumber() / LAMPORTS_PER_SOL} SOL`;
        console.log("Result is in SOL (matches NATIVE_MINT)");
      } else {
        // For non-native tokens, we could fetch token metadata to get decimals
        // For now, display raw amount with token address
        formattedFee = `${feeResult.amount.toString()} (Token: ${feeToken.toString()})`;
        console.log("Result is in a token other than SOL");
      }

      console.log(`Fee Amount: ${formattedFee}`);
      console.log(`Fee in Juels: ${feeResult.juels.toString()}`);
      console.log(`Fee Token: ${feeToken.toString()}`);

      return feeResult;
    } catch (error) {
      console.error("\nError getting CCIP router fee:");
      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);

        // Check for context in enhanced errors
        if ((error as any).context) {
          console.error("\nError Context:");
          console.error(JSON.stringify((error as any).context, null, 2));
        }
      } else {
        console.error("Unknown error:", error);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed to get CCIP router fee:", error);
    printUsage("ccip:fee");
    process.exit(1);
  }
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("ccip:fee");
  process.exit(0);
}

// Run the function
getRouterFee().then(
  (result) => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
