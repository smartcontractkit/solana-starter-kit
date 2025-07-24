import { ethers } from "ethers";
import { Logger } from "../../../ccip-lib/evm";

/**
 * Wallet utility functions for EVM chains
 */



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


