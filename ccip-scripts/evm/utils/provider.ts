import { ethers } from "ethers";
import { CCIPEVMWriteProvider } from "../../../ccip-lib/evm";

/**
 * Creates a provider for EVM CCIP operations
 * 
 * @param privateKey Private key for signing transactions
 * @param rpcUrl RPC URL for the EVM network
 * @returns Provider for CCIP operations
 */
export function createProvider(
  privateKey: string,
  rpcUrl: string
): CCIPEVMWriteProvider {
  if (!privateKey) {
    throw new Error("Private key is required");
  }
  
  // Use RPC URL from environment variable if provided
  const finalRpcUrl = process.env.EVM_RPC_URL || rpcUrl;
  
  // Create provider and signer
  const provider = new ethers.JsonRpcProvider(finalRpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  
  // Return provider interface
  return {
    provider,
    signer,
    getAddress: async (): Promise<string> => {
      return signer.address;
    }
  };
}

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

/**
 * Parse an amount string to bigint with proper decimals
 * 
 * @param amount Amount as string (e.g. "0.01")
 * @param decimals Decimals (default: 18 for ETH)
 * @returns Amount as bigint
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
  return ethers.parseUnits(amount, decimals);
} 