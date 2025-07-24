import { ethers } from "ethers";
import {
  createSolanaExtraArgs,
  SolanaExtraArgsOptions,
  CCIPMessageRequest,
  encodeSolanaAddressToBytes32,
} from "../index";
import { Logger } from "../utils/logger";

/**
 * Message creation options for CCIP requests
 */
export interface CCIPMessageOptions {
  /** Destination chain selector */
  destinationChainSelector: bigint;
  /** Receiver address on destination chain */
  receiver: string;
  /** Token amounts to transfer */
  tokenAmounts?: Array<{
    token: string;
    amount: string;
  }>;
  /** Fee token address (ZeroAddress for native) */
  feeToken: string;
  /** Message data (optional) */
  data?: string;
  /** Solana-specific execution parameters */
  solanaParams?: {
    computeUnits?: number;
    accountIsWritableBitmap?: bigint;
    allowOutOfOrderExecution?: boolean;
    tokenReceiver?: string;
    accounts?: string[];
  };
}

/**
 * Factory for creating CCIP message requests with proper validation and formatting
 */
export class CCIPMessageFactory {
  /**
   * Create a CCIP message request with Solana destination
   * 
   * @param options Message creation options
   * @param logger Optional logger for debugging
   * @returns Properly formatted CCIP message request
   */
  static createSolanaMessage(
    options: CCIPMessageOptions,
    logger?: Logger
  ): CCIPMessageRequest {
    logger?.info("Creating CCIP message request");

    // Validate required fields
    if (!options.receiver) {
      throw new Error("Receiver address is required");
    }

    // Create Solana extra args with defaults
    const extraArgsOptions: SolanaExtraArgsOptions = {
      computeUnits: options.solanaParams?.computeUnits || 0,
      accountIsWritableBitmap: options.solanaParams?.accountIsWritableBitmap || BigInt(0),
      allowOutOfOrderExecution: options.solanaParams?.allowOutOfOrderExecution ?? true,
      tokenReceiver: options.solanaParams?.tokenReceiver,
      accounts: options.solanaParams?.accounts || [],
    };

    // Log accounts list before encoding for better visibility
    if (options.solanaParams?.accounts && options.solanaParams.accounts.length > 0) {
      logger?.info(`Solana accounts to include: [${options.solanaParams.accounts.join(", ")}]`);
    } else {
      logger?.debug("No additional Solana accounts specified");
    }

    // Use SDK's utility to create properly formatted extra args
    const extraArgs = createSolanaExtraArgs(extraArgsOptions, logger);

    // Create token amounts
    const tokenAmounts = [];
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
      destinationChainSelector: options.destinationChainSelector,
      receiver: encodeSolanaAddressToBytes32(options.receiver),
      tokenAmounts: tokenAmounts,
      feeToken: options.feeToken,
      data: options.data || "0x",
      extraArgs: extraArgs,
    };
  }

  /**
   * Create a token transfer message
   * 
   * @param options Token transfer specific options
   * @param logger Optional logger
   * @returns CCIP message request for token transfer
   */
  static createTokenTransfer(
    options: CCIPMessageOptions & {
      tokenAmounts: Array<{ token: string; amount: string }>;
    },
    logger?: Logger
  ): CCIPMessageRequest {
    if (!options.tokenAmounts || options.tokenAmounts.length === 0) {
      throw new Error("Token amounts are required for token transfer");
    }

    return this.createSolanaMessage(options, logger);
  }

  /**
   * Create an arbitrary message (data only, no tokens)
   * 
   * @param options Message options
   * @param logger Optional logger
   * @returns CCIP message request for arbitrary messaging
   */
  static createArbitraryMessage(
    options: CCIPMessageOptions,
    logger?: Logger
  ): CCIPMessageRequest {
    // Ensure no token amounts for arbitrary messaging
    const messageOptions = { ...options, tokenAmounts: [] };
    return this.createSolanaMessage(messageOptions, logger);
  }

  /**
   * Create a combined data and tokens message
   * 
   * @param options Combined message options
   * @param logger Optional logger
   * @returns CCIP message request for data and tokens
   */
  static createDataAndTokensMessage(
    options: CCIPMessageOptions & {
      data: string;
      tokenAmounts: Array<{ token: string; amount: string }>;
    },
    logger?: Logger
  ): CCIPMessageRequest {
    if (!options.data) {
      throw new Error("Data is required for data and tokens message");
    }
    if (!options.tokenAmounts || options.tokenAmounts.length === 0) {
      throw new Error("Token amounts are required for data and tokens message");
    }

    return this.createSolanaMessage(options, logger);
  }
}