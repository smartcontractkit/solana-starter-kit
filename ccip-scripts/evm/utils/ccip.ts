/**
 * Utility functions for CCIP on EVM chains
 */

/**
 * Gets the CCIP Explorer URL for a message
 *
 * @param messageId CCIP message ID
 * @returns CCIP Explorer URL for the message
 */
export function getCCIPExplorerUrl(messageId: string): string {
  const baseUrl = "https://ccip.chain.link/msg/";

  return `${baseUrl}${messageId}`;
}
