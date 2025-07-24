import { ethers } from "ethers";
import { ERC20Client } from "./contracts/index";
import { CCIPEVMContext } from "./models";
import { Logger } from "../utils/logger";

/**
 * Token details with balance information
 */
export interface TokenDetails {
  tokenClient: ERC20Client;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenBalance: bigint;
}

/**
 * Token amount specification for validation
 */
export interface TokenAmountSpec {
  token: string;
  amount: string;
}

/**
 * Validation result for token amounts
 */
export interface TokenValidationResult {
  validatedAmounts: Map<string, bigint>;
  tokenDetails: TokenDetails[];
}

/**
 * CCIP token validation utilities
 */
export class CCIPTokenValidator {
  /**
   * Validate token amounts against wallet balances
   * 
   * @param context CCIP EVM context with provider and logger
   * @param signerAddress Address of the token holder
   * @param tokenAmounts Array of token amounts to validate
   * @returns Validation result with validated amounts and token details
   */
  static async validateTokenAmounts(
    context: CCIPEVMContext,
    signerAddress: string,
    tokenAmounts: TokenAmountSpec[]
  ): Promise<TokenValidationResult> {
    const { provider, logger } = context;

    if (!tokenAmounts || tokenAmounts.length === 0) {
      throw new Error("No token amounts provided for validation");
    }

    const tokenDetails: TokenDetails[] = [];
    const validatedAmounts = new Map<string, bigint>();

    // Get token details for each token
    for (const { token: tokenAddress } of tokenAmounts) {
      const tokenClient = new ERC20Client(context, tokenAddress);

      // Get token metadata
      const tokenSymbol = await tokenClient.getSymbol();
      const tokenDecimals = await tokenClient.getDecimals();
      const tokenBalance = await tokenClient.getBalance(signerAddress);

      logger.info(`Token: ${tokenSymbol} (${tokenAddress})`);
      logger.info(
        `Token Balance: ${ethers.formatUnits(
          tokenBalance,
          tokenDecimals
        )} ${tokenSymbol}`
      );

      tokenDetails.push({
        tokenClient,
        tokenAddress,
        tokenSymbol,
        tokenDecimals,
        tokenBalance,
      });
    }

    // Validate amounts against balances
    for (const { token, amount } of tokenAmounts) {
      // Find matching token details
      const tokenDetail = tokenDetails.find(
        (td) => td.tokenAddress.toLowerCase() === token.toLowerCase()
      );

      if (!tokenDetail) {
        throw new Error(`Token details not found for ${token}`);
      }

      // Parse amount - all amounts are treated as raw values
      let parsedAmount: bigint;
      try {
        parsedAmount = BigInt(amount);
      } catch (error) {
        throw new Error(
          `Invalid amount format for ${tokenDetail.tokenSymbol}: ${amount}. Expected raw token amount (with all decimals).`
        );
      }

      // Check if balance is sufficient
      if (tokenDetail.tokenBalance < parsedAmount) {
        const formattedBalance = ethers.formatUnits(
          tokenDetail.tokenBalance,
          tokenDetail.tokenDecimals
        );
        const formattedAmount = ethers.formatUnits(
          parsedAmount,
          tokenDetail.tokenDecimals
        );

        throw new Error(
          `Insufficient ${tokenDetail.tokenSymbol} balance. Have ${formattedBalance}, need ${formattedAmount}`
        );
      }

      logger.info(
        `Transfer Amount: ${ethers.formatUnits(
          parsedAmount,
          tokenDetail.tokenDecimals
        )} ${tokenDetail.tokenSymbol}`
      );
      
      validatedAmounts.set(token, parsedAmount);
    }

    return {
      validatedAmounts,
      tokenDetails,
    };
  }

  /**
   * Get token details for multiple tokens without validation
   * 
   * @param context CCIP EVM context
   * @param signerAddress Address to check balances for
   * @param tokenAddresses Array of token addresses
   * @returns Array of token details
   */
  static async getTokenDetails(
    context: CCIPEVMContext,
    signerAddress: string,
    tokenAddresses: string[]
  ): Promise<TokenDetails[]> {
    if (tokenAddresses.length === 0) {
      throw new Error("No token addresses provided");
    }

    const results: TokenDetails[] = [];

    for (const tokenAddress of tokenAddresses) {
      const tokenClient = new ERC20Client(context, tokenAddress);

      // Get token details
      const tokenSymbol = await tokenClient.getSymbol();
      const tokenDecimals = await tokenClient.getDecimals();
      const tokenBalance = await tokenClient.getBalance(signerAddress);

      context.logger.info(`Token: ${tokenSymbol} (${tokenAddress})`);
      context.logger.info(
        `Token Balance: ${ethers.formatUnits(
          tokenBalance,
          tokenDecimals
        )} ${tokenSymbol}`
      );

      results.push({
        tokenClient,
        tokenAddress,
        tokenSymbol,
        tokenDecimals,
        tokenBalance,
      });
    }

    return results;
  }
}