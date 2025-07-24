import { ethers } from "ethers";

/**
 * Formats a balance for display
 *
 * @param balance Raw balance
 * @param decimals Decimals (default: 18 for ETH)
 * @returns Formatted balance string
 */
export function formatBalance(balance: bigint, decimals: number = 18): string {
  return ethers.formatUnits(balance, decimals);
}
