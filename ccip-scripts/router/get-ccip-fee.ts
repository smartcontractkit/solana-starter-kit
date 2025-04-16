import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { resolve } from "path";

// Import from SDK for model types and logger
import { CCIPFeeRequest, LogLevel, AddressConversion } from "../../ccip-sdk";

// Import our local utilities
import { getCCIPConfig } from "../config";
import { loadKeypair } from "../utils/provider";
import { createCCIPClient } from "../utils/client-factory";

// Test keypair path for development/testing purposes
const TEST_KEYPAIR_PATH = resolve(
  process.env.HOME || "",
  ".config/solana/keytest.json"
);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: { logLevel?: LogLevel } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--log-level" && i + 1 < args.length) {
      const level = args[i + 1].toUpperCase();
      switch (level) {
        case "TRACE":
          options.logLevel = LogLevel.TRACE;
          break;
        case "DEBUG":
          options.logLevel = LogLevel.DEBUG;
          break;
        case "INFO":
          options.logLevel = LogLevel.INFO;
          break;
        case "WARN":
          options.logLevel = LogLevel.WARN;
          break;
        case "ERROR":
          options.logLevel = LogLevel.ERROR;
          break;
        case "SILENT":
          options.logLevel = LogLevel.SILENT;
          break;
        default:
          console.warn(`Unknown log level: ${level}, using INFO`);
          options.logLevel = LogLevel.INFO;
      }
      i++; // Skip the next argument
    }
  }

  return options;
}

async function getRouterFee() {
  // Parse command line arguments
  const options = parseArgs();

  // Use test keypair path for development/testing
  const keypairPath = TEST_KEYPAIR_PATH;
  console.log("\n==== Environment Information ====");
  console.log("Solana Cluster:", "devnet");
  console.log("Keypair Path:", keypairPath);
  console.log("Log Level:", LogLevel[options.logLevel ?? LogLevel.INFO]);

  // Load the wallet keypair
  const walletKeypair = loadKeypair(keypairPath);
  console.log("Wallet Public Key:", walletKeypair.publicKey.toString());

  // Get the configuration
  const network = "devnet";
  const config = getCCIPConfig(network);

  // Create the CCIPClient with our factory
  const ccipClient = createCCIPClient({
    network,
    keypairPath,
    logLevel: options.logLevel,
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
  console.log("CCIP Router Program ID:", config.ccipRouterProgramId.toString());
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
  console.log("- Fee Token:", config.nativeSol.toString(), "(Native SOL)");

  // Convert the EVM address to the format expected by Solana using SDK's AddressConversion
  const receiverBytes = AddressConversion.evmAddressToSolanaBytes(EVM_RECEIVER);

  // Convert amount to on-chain representation with proper decimals
  const onChainAmount = new anchor.BN(
    TOKEN_AMOUNT * Math.pow(10, TOKEN_DECIMALS)
  );

  // For native SOL fee, use config.nativeSol
  const feeToken = config.nativeSol;

  // Create the CCIPFeeRequest using values from config
  const feeRequest: CCIPFeeRequest = {
    destChainSelector: new anchor.BN(config.ethereumSepoliaSelector.toString()),
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
    AddressConversion.bytesToHexString(receiverBytes)
  );
  console.log("- On-chain amount:", onChainAmount.toString());
  console.log("- Token mint:", config.tokenMint.toString());
  console.log("- Fee token:", feeToken.toString());
  console.log(
    "- Destination chain:",
    config.ethereumSepoliaSelector.toString()
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
}

// Show usage information
function printUsage() {
  console.log(`
Usage: ts-node get-ccip-fee.ts [options]

Options:
  --log-level LEVEL    Set the logging level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
                       Default: INFO

Examples:
  ts-node get-ccip-fee.ts                       # Run with default INFO level
  ts-node get-ccip-fee.ts --log-level TRACE     # Run with TRACE level for maximum detail
  ts-node get-ccip-fee.ts --log-level DEBUG     # Run with DEBUG level
  `);
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage();
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
