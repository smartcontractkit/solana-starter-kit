/**
 * EVM to Solana CCIP Arbitrary Messaging Example
 *
 * This tutorial demonstrates how to send arbitrary messages from Ethereum Sepolia to Solana Devnet
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol). No tokens are transferred.
 *
 * INSTRUCTIONS:
 * 1. Set up your environment variables in .env:
 *    - EVM_PRIVATE_KEY: Your Ethereum private key
 *    - EVM_RPC_URL (optional): Custom RPC URL for Ethereum Sepolia
 *
 * 2. Customize the message parameters below if needed
 *
 * 3. Run the script with: npm run evm:arbitrary-message
 *
 * You can override settings with command line arguments:
 * --fee-token       : Token to use for fees (native, wrapped-native, link, or address)
 * --receiver        : Solana receiver address
 * --data            : Message data to send (string or hex with 0x prefix)
 * --compute-units   : Solana compute units
 * --log-level       : Logging verbosity (0-5, where 0 is most verbose)
 *
 * Example:
 * npm run evm:arbitrary-message -- --data "Hello, Solana!"
 */

import { parseScriptArgs } from "../utils/message-utils";
import { setupClientContext } from "../utils/setup-client";
import {
  createCCIPMessageRequest,
  displayTransferSummary,
  displayTransferResults,
} from "../utils/message-utils";
import { printUsage } from "../utils/config-parser";
import { createLogger, LogLevel } from "../../../ccip-lib/evm";
import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { ChainId, FeeTokenType, getCCIPSVMConfig } from "../../config";

// Create initial logger for startup errors
const initialLogger = createLogger("arbitrary-messaging", {
  level: LogLevel.INFO,
});

// =================================================================
// ARBITRARY MESSAGE CONFIGURATION
// Edit these values to customize your message
// =================================================================

const MESSAGE_CONFIG = {
  // Custom message to send - must be properly encoded as hex with 0x prefix
  // This example encodes "Hello World" to hex
  data: "0x" + Buffer.from("Hello World").toString("hex"),

  // Destination program on Solana that will receive the message
  receiver: getCCIPSVMConfig(
    ChainId.SOLANA_DEVNET
  ).receiverProgramId.toString(),

  // Fee token to use for CCIP fees
  feeToken: FeeTokenType.LINK,

  // No tokens are transferred with this message
  // An empty array means no tokens will be sent
  tokenAmounts: [],

  // Extra configuration for Solana
  extraArgs: {
    // Compute units for Solana execution
    // Higher value needed because message processing requires compute units
    computeUnits: 200000,

    // Allow out-of-order execution
    allowOutOfOrderExecution: true,

    // Bitmap of accounts that should be made writeable (advanced usage)
    accountIsWritableBitmap: BigInt(0),

    // Token receiver - for arbitrary messages, this is usually the default PublicKey
    tokenReceiver: PublicKey.default.toString(),

    // PDA or other accounts that should be made writeable
    accounts: ["52XvWQKuZHRjnR7qHsEGS532jqgQ3MBiBMgVzBowP1LD"],
  },
};
// =================================================================

/**
 * Main arbitrary messaging function
 */
async function arbitraryMessaging(): Promise<void> {
  let logger = initialLogger;

  try {
    // STEP 1: Get configuration from both hardcoded values and optional command line args
    const cmdOptions = parseScriptArgs();

    // Combine hardcoded config with any command line overrides
    const options = {
      // Start with hardcoded values
      data: MESSAGE_CONFIG.data,
      receiver: MESSAGE_CONFIG.receiver,
      feeToken: MESSAGE_CONFIG.feeToken,
      amount: "0", // Always 0 for pure messaging
      computeUnits: MESSAGE_CONFIG.extraArgs.computeUnits,
      allowOutOfOrderExecution:
        MESSAGE_CONFIG.extraArgs.allowOutOfOrderExecution,
      accountIsWritableBitmap: MESSAGE_CONFIG.extraArgs.accountIsWritableBitmap,
      tokenReceiver: MESSAGE_CONFIG.extraArgs.tokenReceiver,
      accounts: MESSAGE_CONFIG.extraArgs.accounts,
      // Command line arguments override hardcoded config
      ...cmdOptions,
    };

    // Force amount to "0" to ensure no tokens are transferred
    options.amount = "0";

    // Ensure we have message data
    if (!options.data || options.data === "0x") {
      options.data = MESSAGE_CONFIG.data;
      logger.info(`No message data provided, using default message data`);
    }

    // STEP 2: Set up client context (logger, provider, config)
    const context = await setupClientContext(options, "arbitrary-messaging");

    // Use the properly configured logger from context
    logger = context.logger;

    const { client, config, signerAddress } = context;

    // STEP 3: Create the CCIP message request
    const messageRequest = createCCIPMessageRequest(config, options, logger);

    // STEP 4: Display message summary
    displayTransferSummary(
      config,
      options,
      messageRequest,
      null,
      logger,
      signerAddress
    );

    // STEP 5: Send the CCIP message
    logger.info("\nSending CCIP message...");

    try {
      // Execute message sending - the SDK handles approvals automatically
      const result = await client.sendCCIPMessage(messageRequest);

      // STEP 6: Display results
      displayTransferResults(result, config, logger);
    } catch (error) {
      logger.error("Failed to send CCIP message", error);
      throw error;
    }
  } catch (error) {
    logger.error("\n❌ Error executing arbitrary messaging:");
    if (error instanceof Error) {
      logger.error(error.message);
      if (error.stack) {
        logger.error(error.stack);
      }
    } else {
      logger.error(String(error));
    }

    printUsage("evm:arbitrary-message");
    process.exit(1);
  }
}

// Run the script
arbitraryMessaging().catch((error) => {
  initialLogger.error("Unhandled error in arbitrary messaging:", error);
  process.exit(1);
});
