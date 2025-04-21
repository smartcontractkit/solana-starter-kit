/**
 * Token Utility Functions
 * 
 * This module provides utility functions for working with tokens
 * on Solana, including determining token program IDs, fetching
 * token decimals, and formatting token amounts.
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/**
 * Message configuration interface
 */
export interface MessageConfig {
  // Token configuration
  tokenMint: PublicKey | string;
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

/**
 * Determine the token program ID that owns a mint account
 * @param mintPubkey The mint account public key
 * @param connection Solana connection instance
 * @param logger Logger for output
 * @returns The PublicKey of the token program that owns the mint
 */
export async function determineTokenProgramId(
  mintPubkey: PublicKey,
  connection: Connection,
  logger: any
): Promise<PublicKey> {
  try {
    logger.info(`Getting mint account info for ${mintPubkey.toString()} to determine token program ID...`);
    const mintInfo = await connection.getAccountInfo(mintPubkey);

    if (!mintInfo) {
      throw new Error(`Mint account ${mintPubkey.toString()} not found`);
    }

    // The owner of the mint account is the token program
    const tokenProgramId = new PublicKey(mintInfo.owner);

    // Log which token program is being used
    const isToken2022 = tokenProgramId.equals(TOKEN_2022_PROGRAM_ID);
    const isStandardToken = tokenProgramId.equals(TOKEN_PROGRAM_ID);

    if (isToken2022) {
      logger.info(`Detected Token-2022 Program: ${tokenProgramId.toString()}`);
    } else if (isStandardToken) {
      logger.info(`Detected Standard Token Program: ${tokenProgramId.toString()}`);
    } else {
      logger.warn(`Unknown token program ID: ${tokenProgramId.toString()}`);
    }

    return tokenProgramId;
  } catch (error) {
    logger.warn(
      `Failed to determine token program from mint, falling back to TOKEN_2022_PROGRAM_ID: ${error instanceof Error ? error.message : String(error)}`
    );
    return TOKEN_2022_PROGRAM_ID;
  }
}

/**
 * Fetches token decimals from a mint account
 * @param connection Solana connection
 * @param mintAddress Token mint public key
 * @param tokenProgramId Token program ID that owns the mint
 * @param logger Logger instance
 * @returns Number of decimals for the token
 */
export async function fetchTokenDecimals(
  connection: Connection,
  mintAddress: PublicKey,
  tokenProgramId: PublicKey,
  logger: any
): Promise<number> {
  try {
    logger.info(`Fetching token decimals for ${mintAddress.toString()}`);
    const mintInfo = await getMint(
      connection,
      mintAddress,
      undefined,
      tokenProgramId
    );
    logger.info(`Token ${mintAddress.toString()} has ${mintInfo.decimals} decimals`);
    return mintInfo.decimals;
  } catch (error) {
    logger.error(`Failed to fetch token decimals: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn("Defaulting to 9 decimals as fallback");
    return 9; // Default to 9 decimals as fallback
  }
}

/**
 * Formats a raw token amount to human-readable form
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