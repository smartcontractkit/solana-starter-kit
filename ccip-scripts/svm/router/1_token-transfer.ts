/**
 * Solana to Ethereum CCIP Token Transfer Example
 *
 * This tutorial demonstrates how to send tokens from Solana Devnet to Ethereum Sepolia
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with:
 *    - SOL for transaction fees (at least 0.005 SOL)
 *    - Tokens to send (BnM token)
 *
 * 2. Customize the message parameters below if needed
 *
 * 3. Run the script with: yarn svm:token-transfer
 *
 * You can override settings with command line arguments:
 * --fee-token       : Token to use for fees (native, wrapped-native, link, or address)
 * --keypair         : Path to your keypair file
 * --log-level       : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight  : Skip transaction preflight checks
 *
 * Token transfer specific arguments:
 * --token-mint      : Token mint address to transfer (or comma-separated list for multiple tokens)
 * --token-amount    : Amount to transfer (or comma-separated list matching the token-mint order)
 *
 * Example for single token transfer:
 * yarn svm:token-transfer -- --token-mint TokenAddressHere --token-amount 1000000
 *
 * Example for multiple token transfer:
 * yarn svm:token-transfer -- --token-mint "TokenAddress1,TokenAddress2" --token-amount "1000000,2000000"
 */

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
    destinationChainSelector:
      CHAIN_SELECTORS[ChainId.ETHEREUM_SEPOLIA].toString(),
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

    // Message data (empty for token transfers, or custom data for messaging)
    messageData: "", // Empty data for token transfer only

    // Extra arguments configuration
    extraArgs: {
      gasLimit: 0, // No execution on destination for token transfers
      allowOutOfOrderExecution: true, // Allow out-of-order execution
    },
  };
}

const CCIP_MESSAGE_CONFIG: CCIPMessageConfig = {
  // Destination configuration  
  destinationChain: ChainId.ETHEREUM_SEPOLIA,
  destinationChainSelector:
    CHAIN_SELECTORS[ChainId.ETHEREUM_SEPOLIA].toString(),
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

  // Message data (empty for token transfers, or custom data for messaging)
  messageData: "", // Empty data for token transfer only

  // Extra arguments configuration
  extraArgs: {
    gasLimit: 0, // No execution on destination for token transfers
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
    gasLimit: 0, // Default gas limit for token transfers
    allowOutOfOrderExecution: true, // Default to allow out-of-order execution
  },
};
// =================================================================

/**
 * Main token transfer function
 */
async function tokenTransfer(): Promise<void> {
  // Parse command line arguments
  const cmdOptions = parseCCIPArgs("token-transfer");

  // Resolve network configuration
  const config = resolveNetworkConfig(cmdOptions);
  
  // Create network-aware message config
  const messageConfig = createMessageConfig(config);

  // Execute the CCIP script with our configuration
  await executeCCIPScript({
    scriptName: "token-transfer",
    usageName: "svm:token-transfer",
    messageConfig,
    scriptConfig: SCRIPT_CONFIG,
    cmdOptions,
  });
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("svm:token-transfer");
  process.exit(0);
}

// Run the script
tokenTransfer().catch((err) => {
  console.error(`Unhandled error in token transfer: ${err}`);
  process.exit(1);
});
