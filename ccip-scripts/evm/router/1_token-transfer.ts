/**
 * EVM to Solana CCIP Token Transfer Example
 *
 * This tutorial demonstrates how to send tokens from Ethereum Sepolia to Solana Devnet
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 *
 * INSTRUCTIONS:
 * 1. Set up your environment variables in .env:
 *    - EVM_PRIVATE_KEY: Your Ethereum private key
 *    - EVM_RPC_URL (optional): Custom RPC URL for Ethereum Sepolia
 *
 * 2. Customize the message parameters below if needed
 *
 * 3. Run the script with: npm run evm:token-transfer
 *
 * You can override settings with command line arguments:
 * --fee-token       : Token to use for fees (native, wrapped-native, link, or address)
 * --receiver        : Solana receiver address
 * --amount          : Amount of tokens to send (in raw format with all decimals, e.g., "1000000000000000" for 0.001 with 18 decimals)
 * --compute-units   : Solana compute units
 * --log-level       : Logging verbosity (0-5, where 0 is most verbose)
 */

import { parseScriptArgs } from "../utils/message-utils";
import {
  setupClientContext,
  getTokenDetails,
  validateTokenAmounts,
} from "../utils/setup-client";
import {
  createCCIPMessageRequest,
  displayTransferSummary,
  displayTransferResults,
} from "../utils/message-utils";
import { printUsage } from "../utils/config-parser";
import { createLogger, LogLevel } from "../../../ccip-lib/evm";
import { PublicKey } from "@solana/web3.js";
import { FeeTokenType, getEVMConfig, ChainId } from "../../config";

// Create initial logger for startup errors
const initialLogger = createLogger("token-transfer", {
  level: LogLevel.INFO,
});

// Get configuration
const config = getEVMConfig(ChainId.ETHEREUM_SEPOLIA);

// =================================================================
// TOKEN TRANSFER CONFIGURATION
// Edit these values to customize your token transfer
// =================================================================

const MESSAGE_CONFIG = {
  // Tokens to transfer - an array of token amounts to send
  // Each token has an address and an amount
  tokenAmounts: [
    {
      // The BnM token address on Ethereum Sepolia
      address: config.tokenAddress,

      // Token amount in raw format (with all decimals included)
      // IMPORTANT: This must be the full raw amount, not a decimal value
      // For example: 1 token with 18 decimals would be "1000000000000000000"
      amount: "1000000000000000", // 0.001 tokens with 18 decimals
    },
  ],

  // Fee token to use for CCIP fees
  feeToken: FeeTokenType.LINK,

  // Message data (empty for token transfers)
  // Do not change for simple token transfers
  data: "0x",

  // Extra configuration for Solana
  extraArgs: {
    // Compute units for Solana execution
    // For token transfers, no execution happens on destination, so 0 is sufficient
    computeUnits: 0,

    // Allow out-of-order execution
    allowOutOfOrderExecution: true,

    // Bitmap of accounts that should be made writeable (advanced usage)
    accountIsWritableBitmap: BigInt(0),

    // Token receiver wallet address (where tokens will arrive)
    // This must be a Solana wallet public key
    tokenReceiver: "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB",

    // Additional accounts to make writeable (for complex use cases)
    accounts: [],
  },

  // Receiver address - for token transfers, this should be the default PublicKey
  // Do not change for token transfers
  receiver: PublicKey.default.toString(),
};
// =================================================================

/**
 * Main token transfer function
 */
async function tokenTransfer(): Promise<void> {
  let logger = initialLogger;

  try {
    // STEP 1: Get configuration from both hardcoded values and optional command line args
    const cmdOptions = parseScriptArgs();

    // Convert the MESSAGE_CONFIG.tokenAmounts to the format expected by the SDK
    const configTokenAmounts = MESSAGE_CONFIG.tokenAmounts.map((ta) => ({
      token: ta.address,
      amount: ta.amount,
    }));

    // Combine hardcoded config with any command line overrides
    const options = {
      // Start with hardcoded values
      receiver: MESSAGE_CONFIG.receiver,
      feeToken: MESSAGE_CONFIG.feeToken,
      data: MESSAGE_CONFIG.data,
      computeUnits: MESSAGE_CONFIG.extraArgs.computeUnits,
      allowOutOfOrderExecution:
        MESSAGE_CONFIG.extraArgs.allowOutOfOrderExecution,
      accountIsWritableBitmap: MESSAGE_CONFIG.extraArgs.accountIsWritableBitmap,
      tokenReceiver: MESSAGE_CONFIG.extraArgs.tokenReceiver,
      accounts: MESSAGE_CONFIG.extraArgs.accounts,

      // Use token amounts from command line or config (ensuring we always have token amounts)
      tokenAmounts:
        cmdOptions.tokenAmounts && cmdOptions.tokenAmounts.length > 0
          ? cmdOptions.tokenAmounts
          : configTokenAmounts,

      // Command line arguments override hardcoded config
      ...cmdOptions,
    };

    // Ensure we have tokenAmounts
    if (!options.tokenAmounts || options.tokenAmounts.length === 0) {
      throw new Error(
        "No token amounts provided. Please specify at least one token amount to transfer."
      );
    }

    // STEP 2: Set up client context (logger, provider, config)
    const context = await setupClientContext(options, "token-transfer");

    // Use the properly configured logger from context
    logger = context.logger;

    const { client, config, signerAddress } = context;

    // STEP 3: Get token details and validate balances
    const tokenDetails = await getTokenDetails(context, options.tokenAmounts);
    const validatedAmounts = validateTokenAmounts(context, tokenDetails);

    // STEP 4: Create the CCIP message request
    const messageRequest = createCCIPMessageRequest(config, options, logger);

    // STEP 5: Display transfer summary
    // Use the first token for display purposes in the legacy summary function
    const primaryToken = tokenDetails[0];
    displayTransferSummary(
      config,
      options,
      messageRequest,
      {
        symbol: primaryToken.tokenSymbol,
        decimals: primaryToken.tokenDecimals,
      },
      logger,
      signerAddress
    );

    // STEP 6: Send the CCIP message
    logger.info("\nSending CCIP message...");

    try {
      // Execute transfer using sendCCIPMessage - the SDK handles token approvals automatically
      const result = await client.sendCCIPMessage(messageRequest);

      // STEP 7: Display transfer results
      displayTransferResults(result, config, logger);
    } catch (error) {
      logger.error("Failed to send CCIP message", error);
      throw error;
    }
  } catch (error) {
    logger.error("\n❌ Error executing token transfer:");
    if (error instanceof Error) {
      logger.error(error.message);
      if (error.stack) {
        logger.error(error.stack);
      }
    } else {
      logger.error(String(error));
    }

    printUsage("evm:token-transfer");
    process.exit(1);
  }
}

// Run the script
tokenTransfer().catch((error) => {
  initialLogger.error("Unhandled error in token transfer:", error);
  process.exit(1);
});
