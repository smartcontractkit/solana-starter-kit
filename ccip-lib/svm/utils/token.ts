import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Logger } from "./logger";

/**
 * Automatically detects the token program for a given mint by checking on-chain data
 * 
 * Enhanced version that combines the best practices from both script and SDK implementations.
 * Provides detailed logging about which token program is detected and falls back gracefully
 * on errors.
 *
 * @param tokenMint The token mint public key
 * @param connection Solana connection
 * @param logger Optional logger for debug output
 * @returns The detected token program public key
 */
export async function detectTokenProgram(
  tokenMint: PublicKey,
  connection: Connection,
  logger?: Logger
): Promise<PublicKey> {
  try {
    logger?.info(`Getting mint account info for ${tokenMint.toString()} to determine token program ID...`);
    const tokenMintInfo = await connection.getAccountInfo(tokenMint);
    
    if (!tokenMintInfo) {
      logger?.warn(`Mint account ${tokenMint.toString()} not found, using fallback token program ${TOKEN_2022_PROGRAM_ID.toString()}`);
      return TOKEN_2022_PROGRAM_ID;
    }

    // The owner of the mint account is the token program
    const tokenProgram = tokenMintInfo.owner;

    // Log which token program is being used with detailed information
    const isToken2022 = tokenProgram.equals(TOKEN_2022_PROGRAM_ID);
    const isStandardToken = tokenProgram.equals(TOKEN_PROGRAM_ID);

    if (isToken2022) {
      logger?.info(`Detected Token-2022 Program: ${tokenProgram.toString()}`);
    } else if (isStandardToken) {
      logger?.info(`Detected Standard Token Program: ${tokenProgram.toString()}`);
    } else {
      logger?.warn(`Unknown token program ID: ${tokenProgram.toString()}`);
    }

    return tokenProgram;
  } catch (error) {
    logger?.warn(
      `Failed to determine token program from mint, falling back to TOKEN_2022_PROGRAM_ID: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return TOKEN_2022_PROGRAM_ID;
  }
}

/**
 * Fetches token decimals from a mint account
 * 
 * @param connection Solana connection
 * @param mintAddress Token mint public key
 * @param tokenProgramId Token program ID that owns the mint
 * @param logger Optional logger instance
 * @returns Number of decimals for the token
 */
export async function fetchTokenDecimals(
  connection: Connection,
  mintAddress: PublicKey,
  tokenProgramId: PublicKey,
  logger?: Logger
): Promise<number> {
  try {
    logger?.info(`Fetching token decimals for ${mintAddress.toString()}`);
    const mintInfo = await getMint(
      connection,
      mintAddress,
      undefined,
      tokenProgramId
    );
    logger?.info(`Token ${mintAddress.toString()} has ${mintInfo.decimals} decimals`);
    return mintInfo.decimals;
  } catch (error) {
    logger?.error(`Failed to fetch token decimals: ${error instanceof Error ? error.message : String(error)}`);
    logger?.warn("Defaulting to 9 decimals as fallback");
    return 9; // Default to 9 decimals as fallback
  }
}

/**
 * Formats a raw token amount to human-readable form
 * 
 * @param rawAmount Raw token amount (string or BN)
 * @param decimals Token decimals
 * @returns Formatted human-readable amount
 */
export function formatTokenAmount(
  rawAmount: string | anchor.BN, 
  decimals: number
): string {
  // Convert the input to a string representation
  let amountStr: string;
  
  if (rawAmount instanceof anchor.BN) {
    amountStr = rawAmount.toString();
  } else {
    amountStr = rawAmount;
  }
  
  // For very large numbers, we need to handle the decimal point manually
  if (amountStr.length <= decimals) {
    // Pad with leading zeros if needed
    amountStr = amountStr.padStart(decimals + 1, '0');
  }
  
  // Insert decimal point at the right position
  const integerPart = amountStr.slice(0, -decimals) || '0';
  const fractionalPart = amountStr.slice(-decimals);
  
  // Format with appropriate number of decimal places
  const formattedAmount = `${integerPart}.${fractionalPart}`;
  
  // Parse and format to remove trailing zeros if needed
  const parsedNumber = parseFloat(formattedAmount);
  return parsedNumber.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * Converts a raw token amount to an on-chain representation
 * 
 * @param rawAmount Raw token amount (string or BN)
 * @returns Anchor BN representation for on-chain use
 */
export function toOnChainAmount(
  rawAmount: string | anchor.BN
): anchor.BN {
  if (rawAmount instanceof anchor.BN) {
    return rawAmount;
  } else {
    return new anchor.BN(rawAmount);
  }
}
