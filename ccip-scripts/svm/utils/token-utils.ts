/**
 * CCIP Message Utility Functions
 * 
 * This module provides utility functions for CCIP message handling
 * and configuration. Token-specific utilities have been moved to the SDK.
 * 
 * NOTE: Token utilities (detectTokenProgram, fetchTokenDecimals, etc.) 
 * have been moved to ccip-lib/svm/utils/token.ts - import from SDK instead.
 */

// Only import what's needed for remaining functions

/**
 * Message configuration interface
 */
export interface MessageConfig {
  // Token configuration
  tokenMint: string;
  tokenAmount: number | string;

  // Destination configuration
  destinationChain: string;
  destinationChainSelector: string | number;
  evmReceiverAddress: string;

  // Fee configuration
  feeToken: string;

  // Message data
  messageData: string;

  // Extra arguments configuration
  extraArgs: {
    gasLimit: number;
    allowOutOfOrderExecution: boolean;
  };

  // Transaction configuration
  computeUnits: number;
  minSolRequired: number;
}

// Note: Token utility functions have been moved to the SDK (ccip-lib/svm/utils/token.ts)
// Import them from the SDK instead:
// import { detectTokenProgram, fetchTokenDecimals, formatTokenAmount, toOnChainAmount } from "../../../ccip-lib/svm";

/**
 * Converts a hex or plain string to a Buffer for message data
 * @param messageData String data input
 * @returns Buffer representation
 */
export function messageDataToBuffer(messageData: string): Buffer {
  if (!messageData) {
    return Buffer.alloc(0);
  }
  
  return messageData.startsWith("0x") 
    ? Buffer.from(messageData.slice(2), "hex") 
    : Buffer.from(messageData);
} 