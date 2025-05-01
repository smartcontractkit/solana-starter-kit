import { ethers } from "ethers";
import {
  createSolanaExtraArgs,
  SolanaExtraArgsOptions,
  CCIPMessageResult,
  CCIPMessageRequest,
  encodeSolanaAddressToBytes32,
} from "../../../ccip-lib/evm";
import { parseCommonArgs } from "./config-parser";
import { getCCIPExplorerUrl } from "./ccip";
import { Logger } from "../../../ccip-lib/evm/utils/logger";
import { 
  ChainId, 
  EVMChainConfig, 
  getEVMConfig, 
  getEVMFeeTokenAddress, 
  getExplorerUrl,
  CHAIN_SELECTORS
} from "../../config";

/**
 * Extended command line options with script-specific parameters
 */
export interface CCIPScriptOptions {
  privateKey?: string;
  logLevel?: number;
  receiver?: string;
  data?: string;
  feeToken?: string;
  amount?: string;
  computeUnits?: number;
  allowOutOfOrderExecution?: boolean;
  accountIsWritableBitmap?: bigint;
  tokenReceiver?: string;
  accounts?: string[];
  tokenAmounts?: Array<{
    token: string;
    amount: string;
  }>;
  chainId: ChainId;
}

/**
 * Parse command line arguments for CCIP scripts
 * @returns Parsed options
 */
export function parseScriptArgs(): CCIPScriptOptions {
  // Get options from the common parser
  const baseOptions = parseCommonArgs();

  // Return options directly since we're hardcoding defaults in each script
  return baseOptions as CCIPScriptOptions;
}

/**
 * Create a CCIP message request with proper formatting
 * @param config Network configuration
 * @param options Message options
 * @param logger Logger instance
 * @returns Properly formatted CCIP message request
 */
export function createCCIPMessageRequest(
  config: EVMChainConfig,
  options: CCIPScriptOptions,
  logger: Logger
): CCIPMessageRequest {
  logger.info("Creating CCIP message request");

  // Validate required fields
  if (!options.receiver) {
    throw new Error("Receiver address is required");
  }

  // Determine fee token - default to LINK
  const feeToken = getEVMFeeTokenAddress(config, options.feeToken);
  logger.info(
    `Using fee token: ${
      feeToken === ethers.ZeroAddress ? "Native ETH" : feeToken
    }`
  );

  // Create Solana extra args with sensible defaults
  const extraArgsOptions: SolanaExtraArgsOptions = {
    computeUnits: options.computeUnits, // Default compute units
    accountIsWritableBitmap: BigInt(options.accountIsWritableBitmap),
    allowOutOfOrderExecution: options.allowOutOfOrderExecution,
    tokenReceiver: options.tokenReceiver,
    accounts: options.accounts,
  };

  // Use SDK's utility to create properly formatted extra args
  const extraArgs = createSolanaExtraArgs(extraArgsOptions, logger);

  // Create token amounts
  const tokenAmounts = [];

  // Handle tokenAmounts array if provided
  if (options.tokenAmounts && options.tokenAmounts.length > 0) {
    for (const tokenAmount of options.tokenAmounts) {
      if (tokenAmount.amount && tokenAmount.amount !== "0") {
        tokenAmounts.push({
          token: tokenAmount.token,
          amount: BigInt(tokenAmount.amount),
        });
      }
    }
  }

  // Create the CCIP message request
  return {
    destinationChainSelector: ChainId.SOLANA_DEVNET ? CHAIN_SELECTORS[ChainId.SOLANA_DEVNET] : BigInt("16423721717087811551"),
    receiver: encodeSolanaAddressToBytes32(options.receiver),
    tokenAmounts: tokenAmounts,
    feeToken: feeToken,
    data: options.data,
    extraArgs: extraArgs,
  };
}

/**
 * Calculates the byte length of a hex string.
 * @param hexString - The hex string to measure (with or without '0x' prefix)
 * @returns The number of bytes represented by the hex string
 */
function getHexByteLength(hexString: string | undefined | null): number {
  if (!hexString) return 0;
  
  // Remove '0x' prefix if present
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  
  // Validate hex string format
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    console.warn('Invalid hex string detected');
    return 0;
  }
  
  // Each byte is represented by 2 hex characters
  return cleanHex.length / 2;
}

/**
 * Display CCIP transfer summary information
 * @param config Network configuration
 * @param options Message options
 * @param messageRequest The message request
 * @param tokenInfo Optional token information
 * @param logger Logger instance
 * @param senderAddress Optional sender address
 */
export function displayTransferSummary(
  config: EVMChainConfig,
  options: CCIPScriptOptions,
  messageRequest: CCIPMessageRequest,
  tokenInfo: { symbol: string; decimals: number } | null,
  logger: Logger,
  senderAddress?: string
): void {
  logger.info("\n==== Transfer Summary ====");
  logger.info(`Source Chain: ${config.name}`);
  logger.info(`Destination Chain: Solana Devnet (${messageRequest.destinationChainSelector.toString()})`);

  if (senderAddress) {
    logger.info(`Sender: ${senderAddress}`);
  }

  logger.info(`Receiver: ${options.receiver}`);

  // Display token receiver if different from receiver
  if (options.tokenReceiver && options.tokenReceiver !== options.receiver) {
    logger.info(`Token Receiver: ${options.tokenReceiver}`);
  }

  // Display fee token information
  const feeTokenDisplay =
    messageRequest.feeToken === ethers.ZeroAddress
      ? "Native ETH"
      : messageRequest.feeToken;
  logger.info(`Fee Token: ${feeTokenDisplay}`);

  // Display token amounts if any
  if (messageRequest.tokenAmounts && messageRequest.tokenAmounts.length > 0) {
    logger.info(`\nToken Transfers:`);

    for (let i = 0; i < messageRequest.tokenAmounts.length; i++) {
      const { token, amount } = messageRequest.tokenAmounts[i];
      let formattedAmount = amount.toString();

      // Format with decimals if token info available
      if (
        tokenInfo &&
        (token === tokenInfo.symbol ||
          token.toLowerCase() === config.bnmTokenAddress.toLowerCase())
      ) {
        formattedAmount = ethers.formatUnits(amount, tokenInfo.decimals);
        logger.info(
          `  ${i + 1}. ${formattedAmount} ${tokenInfo.symbol} (${token})`
        );
      } else {
        logger.info(`  ${i + 1}. ${formattedAmount} raw units (${token})`);
      }
    }
  } else {
    logger.info(`No tokens being transferred`);
  }

  // Display message data if any
  if (messageRequest.data && messageRequest.data !== "0x") {
    logger.info(`\nMessage Data: ${messageRequest.data}`);
    logger.info(`Message Data Size: ${getHexByteLength(messageRequest.data)} bytes`);
    
    // Try to decode as UTF-8 if it looks like text
    try {
      const dataWithout0x = messageRequest.data.startsWith("0x")
        ? messageRequest.data.slice(2)
        : messageRequest.data;
      const textData = Buffer.from(dataWithout0x, "hex").toString();
      if (/^[\x20-\x7E]*$/.test(textData)) {
        // Check if ASCII printable
        logger.info(`Message Data (decoded): ${textData}`);
      }
    } catch (e) {
      // Ignore decoding errors
    }
  }

  // Display extra args info
  logger.info(
    `\nExtra Args: Solana-specific, ${getHexByteLength(messageRequest.extraArgs)} bytes`
  );

  // Display accounts if any
  if (options.accounts && options.accounts.length > 0) {
    logger.info(`Additional Accounts: ${options.accounts.join(", ")}`);
  }

  // Display accountIsWritableBitmap if provided
  if (options.accountIsWritableBitmap) {
    logger.info(
      `Account Is Writable Bitmap: ${options.accountIsWritableBitmap}`
    );
  }
}

/**
 * Display the results of a CCIP transfer
 * @param result Message result from the SDK
 * @param config Network configuration
 * @param logger Logger instance
 */
export function displayTransferResults(
  result: CCIPMessageResult,
  config: EVMChainConfig,
  logger: Logger
): void {
  logger.info("\n==== Transfer Results ====");
  logger.info(`Transaction Hash: ${result.transactionHash}`);
  logger.info(
    `Transaction URL: ${getExplorerUrl(config.id, result.transactionHash)}`
  );

  if (result.messageId) {
    logger.info(`Message ID: ${result.messageId}`);
    logger.info(`CCIP Explorer: ${getCCIPExplorerUrl(result.messageId)}`);

    if (result.destinationChainSelector) {
      logger.info(
        `Destination Chain Selector: ${result.destinationChainSelector}`
      );
    }

    if (result.sequenceNumber) {
      logger.info(`Sequence Number: ${result.sequenceNumber}`);
    }

    logger.info("\nMessage tracking for Solana destinations:");
    logger.info(
      "Please check the CCIP Explorer link to monitor your message status."
    );
  }

  logger.info("\n✅ Cross-chain transfer completed");
}
