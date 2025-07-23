/**
 * Solana to Ethereum CCIP Data and Token Transfer Example
 *
 * This tutorial demonstrates how to send both tokens and arbitrary data from Solana Devnet to Ethereum Sepolia
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with:
 *    - SOL for transaction fees (at least 0.005 SOL)
 *    - Tokens to send (BnM token)
 *
 * 2. Customize the message parameters below if needed
 *
 * 3. Run the script with: yarn svm:data-and-tokens
 *
 * You can override settings with command line arguments:
 * --fee-token       : Token to use for fees (native, wrapped-native, link, or address)
 * --keypair         : Path to your keypair file
 * --log-level       : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight  : Skip transaction preflight checks
 */

// Import AbiCoder from ethers for encoding message data
import { AbiCoder } from "ethers";

// Import our unified configuration
import {
  ChainId,
  getCCIPSVMConfig,
  resolveNetworkConfig,
  CHAIN_SELECTORS,
  FeeTokenType as ConfigFeeTokenType,
} from "../../config";

// Import helper for checking help flag
import {
  printUsage,
  parseCCIPArgs,
  executeCCIPScript,
  CCIPMessageConfig,
} from "../utils";

// Configuration will be resolved from options at runtime

// =================================================================
// CCIP MESSAGE CONFIGURATION
// Core parameters that will be sent in the CCIP message
// =================================================================
// Function to create message config based on network
function createMessageConfig(config: any): CCIPMessageConfig {
  return {
    // Destination configuration
    destinationChain: ChainId.ETHEREUM_SEPOLIA,
    destinationChainSelector: CHAIN_SELECTORS[ChainId.ETHEREUM_SEPOLIA].toString(),
    evmReceiverAddress: "0x9d087fC03ae39b088326b67fA3C788236645b717",

    // Token transfers configuration - supports multiple tokens
    tokenAmounts: [
      {
        tokenMint: config.bnmTokenMint, // BnM token based on network
        amount: "10000000", // String representation of raw token amount (0.01 with 9 decimals)
      },
    ],

    // Fee configuration
    feeToken: ConfigFeeTokenType.NATIVE, // Use SOL for fees

    // Encode message data with ABI encoding
    messageData: (() => {
      const abiCoder = new AbiCoder();
      return abiCoder.encode(
        ["string", "uint256"],
        ["Hello from Solana!", BigInt(42)]
      );
    })(),

    // Extra arguments configuration
    extraArgs: {
      gasLimit: 200000, // Set gas limit for receiver contract execution
      allowOutOfOrderExecution: true, // Allow out-of-order execution
    },
  };
}

const CCIP_MESSAGE_CONFIG: CCIPMessageConfig = {
  // Destination configuration
  destinationChain: ChainId.ETHEREUM_SEPOLIA,
  destinationChainSelector: CHAIN_SELECTORS[ChainId.ETHEREUM_SEPOLIA].toString(),
  evmReceiverAddress: "0x9d087fC03ae39b088326b67fA3C788236645b717",

  // Token transfers configuration - will be resolved at runtime
  tokenAmounts: [
    {
      tokenMint: "PLACEHOLDER", // Will be replaced with actual config
      amount: "10000000", // String representation of raw token amount (0.01 with 9 decimals)
    },
  ],

  // Fee configuration
  feeToken: ConfigFeeTokenType.NATIVE, // Use SOL for fees

  // Message data - ABI-encode a string "Hello World" for EVM compatibility
  messageData: AbiCoder.defaultAbiCoder().encode(["string"], ["Hello World"]),

  // Extra arguments configuration
  extraArgs: {
    gasLimit: 200000, // Set gas limit for message execution on destination chain
    allowOutOfOrderExecution: true, // Allow out-of-order execution
  },
};

// =================================================================
// SCRIPT CONFIGURATION
// Parameters specific to this script, not part of the CCIP message
// =================================================================
const SCRIPT_CONFIG = {
  computeUnits: 1_400_000, // Maximum compute units for Solana
  minSolRequired: 0.005, // Minimum SOL needed for transaction
  
  // Default extraArgs values (used as fallbacks if not provided in message config)
  defaultExtraArgs: {
    gasLimit: 200000, // Default gas limit for message execution
    allowOutOfOrderExecution: true, // Default to allow out-of-order execution
  },
};
// =================================================================

/**
 * Main data and token transfer function
 */
async function dataAndTokenTransfer(): Promise<void> {
  // Parse command line arguments
  const cmdOptions = parseCCIPArgs("data-and-tokens");

  // Resolve network configuration
  const config = resolveNetworkConfig(cmdOptions);
  
  // Create network-aware message config
  const messageConfig = createMessageConfig(config);

  // Execute the CCIP script with our configuration
  await executeCCIPScript({
    scriptName: "data-and-tokens",
    usageName: "svm:data-and-tokens",
    messageConfig,
    scriptConfig: SCRIPT_CONFIG,
    cmdOptions,
  });
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("svm:data-and-tokens");
  process.exit(0);
}

// Run the script
dataAndTokenTransfer().catch((err) => {
  console.error(`Unhandled error in data and token transfer: ${err}`);
  process.exit(1);
});
