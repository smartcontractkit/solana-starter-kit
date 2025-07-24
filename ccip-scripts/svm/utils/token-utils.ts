/**
 * CCIP Message Utility Functions
 *
 * This module provides utility functions for CCIP message handling
 * and configuration. Token-specific utilities have been moved to the SDK.
 *
 * NOTE: Token utilities (detectTokenProgram, fetchTokenDecimals, etc.)
 * have been moved to ccip-lib/svm/utils/token.ts - import from SDK instead.
 */

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
