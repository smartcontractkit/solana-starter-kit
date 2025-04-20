import { ethers } from "ethers";
import { LogLevel } from "../utils/logger";

/**
 * Provider interface for read-only EVM operations
 */
export interface CCIPEVMReadProvider {
  /** The ethers.js provider for network access */
  provider: ethers.Provider;
}

/**
 * Provider interface for EVM operations requiring signing capabilities
 * Extends the read-only provider with signing functionality
 */
export interface CCIPEVMWriteProvider extends CCIPEVMReadProvider {
  /** The ethers.js signer for transaction signing */
  signer: ethers.Signer;

  /**
   * Gets the address of the current signer
   * @returns The signer's address
   */
  getAddress(): Promise<string>;
}

/**
 * Core configuration for CCIP EVM operations
 */
export interface CCIPEVMConfig {
  /** CCIP Router contract address */
  routerAddress: string;

  tokenAdminRegistryAddress?: string;
}

/**
 * Logger interface
 */
export interface Logger {
  trace(...message: any[]): void;
  debug(...message: any[]): void;
  info(...message: any[]): void;
  warn(...message: any[]): void;
  error(...message: any[]): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

/**
 * Client context containing provider, config, and logger
 */
export interface CCIPEVMContext {
  /** The provider for network access (with optional signing capabilities) */
  provider: CCIPEVMReadProvider | CCIPEVMWriteProvider;

  /** The CCIP configuration */
  config: CCIPEVMConfig;

  /** Optional logger instance */
  logger?: Logger;
  
  /** Optional number of confirmations to wait for transactions */
  confirmations?: number;
}

/**
 * Token amount for CCIP transfers
 */
export interface TokenAmount {
  /** Token address */
  token: string;

  /** Token amount as BigInt */
  amount: bigint;
}

/**
 * Options for creating Solana-specific extra arguments
 */
export interface SolanaExtraArgsOptions {
  /** Compute units for Solana execution (similar to gas limit) */
  computeUnits?: number;

  /** Bitmap indicating which accounts are writable */
  accountIsWritableBitmap?: bigint;

  /** Whether to allow out-of-order execution */
  allowOutOfOrderExecution?: boolean;

  /** Specific token receiver address */
  tokenReceiver?: string;

  /** Additional Solana accounts to include */
  accounts?: string[];
}

/**
 * Cross-chain message request parameters
 */
export interface CCIPMessageRequest {
  /** Destination chain selector */
  destinationChainSelector: bigint;

  /** Receiver address (encoded appropriately for destination chain) */
  receiver: string;

  /** Optional token amounts to transfer */
  tokenAmounts?: TokenAmount[];

  /** Token to use for paying fees */
  feeToken: string;

  /** Optional arbitrary message data */
  data?: string;

  /**
   * Extra arguments for destination chain execution as a properly formatted hex string.
   * For Solana destinations, use createSolanaExtraArgs() to generate this string.
   * The format must match the blockchain-specific requirements.
   */
  extraArgs: string;
}

/**
 * Result of a cross-chain message
 */
export interface CCIPMessageResult {
  /** Transaction hash */
  transactionHash: string;

  /** Message ID for tracking */
  messageId?: string;

  /** Block number where transaction was included */
  blockNumber?: number;

  /** Destination chain selector */
  destinationChainSelector?: string;

  /** Sequence number of the message */
  sequenceNumber?: string;
}

/**
 * Fee calculation request parameters
 */
export interface FeeRequest {
  /** Destination chain selector */
  destinationChainSelector: bigint;

  /** Message to calculate fee for */
  message: {
    /** Receiver address */
    receiver: string;

    /** Message data */
    data?: string;

    /** Token amounts to transfer */
    tokenAmounts?: TokenAmount[];

    /** Token to use for paying fees */
    feeToken: string;

    /** Extra arguments for destination chain execution */
    extraArgs: string;
  };
}

/**
 * Result of a fee calculation
 */
export interface FeeResult {
  /** Token used for fee payment */
  token: string;

  /** Fee amount */
  amount: bigint;
}

/**
 * Status of a CCIP message
 */
export enum MessageStatus {
  UNTRIGGERED = 0,
  IN_PROGRESS = 1,
  SUCCESS = 2,
  FAILURE = 3,
}

/**
 * Detailed CCIP message information
 */
export interface CCIPMessage {
  /** Message ID */
  messageId: string;

  /** Sequence number */
  sequenceNumber: bigint;

  /** Sender address */
  sender: string;

  /** Destination chain selector */
  destChainSelector: bigint;

  /** Receiver address */
  receiver: string;

  /** Fee token address */
  feeToken: string;

  /** Fee amount */
  feeAmount: bigint;

  /** Message data */
  data: string;

  /** Token amounts */
  tokenAmounts: Array<{
    token: string;
    amount: bigint;
  }>;
}
