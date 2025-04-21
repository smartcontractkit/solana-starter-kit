import { PublicKey } from "@solana/web3.js";
import { ChainId, FeeTokenType as ConfigFeeTokenType } from "../../../config";
import { CCIPSendOptions, LogLevel } from "../../../../ccip-lib/svm";

/**
 * Token transfer configuration interface
 */
export interface TokenTransfer {
  tokenMint: PublicKey | string;
  amount: number | string;
}

/**
 * Standard message configuration interface shared across all CCIP scripts
 */
export interface CCIPMessageConfig {
  // Destination configuration
  destinationChain: ChainId;
  destinationChainSelector: string | number;
  evmReceiverAddress: string;

  // Token transfers configuration
  tokenAmounts: TokenTransfer[];

  // Fee configuration
  feeToken: ConfigFeeTokenType | string;

  // Message data
  messageData: string;

  // Extra arguments configuration
  extraArgs: {
    gasLimit: number;
    allowOutOfOrderExecution: boolean;
  };
}

/**
 * Script configuration interface for parameters specific to script execution
 */
export interface ScriptConfig {
  computeUnits: number; // Maximum compute units for Solana
  minSolRequired: number; // Minimum SOL needed for transaction
}

/**
 * Extended options for CCIP operations
 */
export interface CCIPOptions extends CCIPSendOptions {
  // For backward compatibility with single token transfers
  tokenMint?: PublicKey | string;
  tokenAmount?: number | string;

  // New multi-token transfer format
  tokenAmounts?: TokenTransfer[];

  // Destination configuration
  destinationChain?: ChainId;
  destinationChainSelector?: string | number;
  evmReceiverAddress?: string;

  // Message data
  messageData?: string;

  // Extra arguments
  extraArgs?: {
    gasLimit: number;
    allowOutOfOrderExecution: boolean;
  };

  // Script-specific configuration
  computeUnits?: number;
  minSolRequired?: number;
  
  // Logging level
  logLevel?: LogLevel;
}

/**
 * Options for executing a CCIP script
 */
export interface ExecutorOptions {
  scriptName: string;
  usageName: string;
  messageConfig: CCIPMessageConfig;
  scriptConfig: ScriptConfig;
  cmdOptions: CCIPOptions;
} 