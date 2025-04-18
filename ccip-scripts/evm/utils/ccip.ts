/**
 * Utility functions for CCIP on EVM chains
 */

/**
 * Formats a transaction URL for block explorer
 *
 * @param txHash Transaction hash
 * @param network Network name
 * @returns Block explorer URL for the transaction
 */
export function getExplorerUrl(
  txHash: string,
  network: string = "sepolia"
): string {
  const baseUrl =
    network === "mainnet"
      ? "https://etherscan.io/tx/"
      : `https://${network}.etherscan.io/tx/`;

  return `${baseUrl}${txHash}`;
}

/**
 * Gets the CCIP Explorer URL for a message
 *
 * @param messageId CCIP message ID
 * @param isProduction Whether to use production or staging URL
 * @returns CCIP Explorer URL for the message
 */
export function getCCIPExplorerUrl(
  messageId: string,
  isProduction: boolean = false
): string {
  const baseUrl = isProduction
    ? "https://ccip.chain.link/msg/"
    : "https://ccip-ui-staging.vercel.app/msg/";

  return `${baseUrl}${messageId}`;
} 