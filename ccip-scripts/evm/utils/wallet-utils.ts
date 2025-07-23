import { ethers } from "ethers";
import { Logger } from "../../../ccip-lib/evm";

/**
 * Wallet utility functions for EVM chains
 */

/**
 * Check if a wallet has the minimum required balance for gas fees
 * 
 * @param provider Ethereum provider instance
 * @param address Wallet address to check
 * @param minimumEth Minimum ETH balance required (default: 0.005)
 * @returns Promise resolving to true if balance is sufficient
 */
export async function hasMinimumBalance(
  provider: ethers.Provider,
  address: string,
  minimumEth: string = "0.005"
): Promise<boolean> {
  const balance = await provider.getBalance(address);
  const minimum = ethers.parseEther(minimumEth);
  return balance >= minimum;
}

/**
 * Get formatted balance for a wallet address
 * 
 * @param provider Ethereum provider instance
 * @param address Wallet address to check
 * @returns Promise resolving to formatted balance string with ETH suffix
 */
export async function getFormattedBalance(
  provider: ethers.Provider,
  address: string
): Promise<string> {
  const balance = await provider.getBalance(address);
  return `${ethers.formatEther(balance)} ETH`;
}

/**
 * Check wallet balance and log appropriate warnings
 * 
 * @param provider Ethereum provider instance
 * @param address Wallet address to check
 * @param logger Logger instance for output
 * @param minimumEth Minimum ETH balance to warn about (default: 0.005)
 * @returns Promise resolving to the actual balance in wei
 */
export async function checkAndWarnBalance(
  provider: ethers.Provider,
  address: string,
  logger: Logger,
  minimumEth: string = "0.005"
): Promise<bigint> {
  const balance = await provider.getBalance(address);
  const formattedBalance = ethers.formatEther(balance);
  
  logger.info(`Native Balance: ${formattedBalance} ETH`);
  
  const minimum = ethers.parseEther(minimumEth);
  if (balance < minimum) {
    logger.warn(
      `⚠️ Warning: Low wallet balance. You may not have enough for gas fees. ` +
      `Current: ${formattedBalance} ETH, Recommended: ${minimumEth} ETH`
    );
  }
  
  return balance;
}

/**
 * Estimate gas cost for a transaction in ETH
 * 
 * @param provider Ethereum provider instance
 * @param gasLimit Estimated gas limit for the transaction
 * @returns Promise resolving to estimated cost in ETH as a string
 */
export async function estimateGasCostInEth(
  provider: ethers.Provider,
  gasLimit: bigint
): Promise<string> {
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei"); // Fallback to 20 gwei
  const estimatedCost = gasLimit * gasPrice;
  return ethers.formatEther(estimatedCost);
}

/**
 * Check if wallet has enough balance for a specific gas cost
 * 
 * @param provider Ethereum provider instance
 * @param address Wallet address to check
 * @param estimatedGasCost Estimated gas cost in wei
 * @param bufferMultiplier Safety buffer multiplier (default: 1.2 for 20% buffer)
 * @returns Promise resolving to object with balance check result
 */
export async function canAffordGas(
  provider: ethers.Provider,
  address: string,
  estimatedGasCost: bigint,
  bufferMultiplier: number = 1.2
): Promise<{
  canAfford: boolean;
  balance: bigint;
  required: bigint;
  shortage?: bigint;
}> {
  const balance = await provider.getBalance(address);
  const requiredWithBuffer = estimatedGasCost * BigInt(Math.floor(bufferMultiplier * 100)) / BigInt(100);
  
  if (balance >= requiredWithBuffer) {
    return {
      canAfford: true,
      balance,
      required: requiredWithBuffer
    };
  } else {
    return {
      canAfford: false,
      balance,
      required: requiredWithBuffer,
      shortage: requiredWithBuffer - balance
    };
  }
}