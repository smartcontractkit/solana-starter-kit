import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { Logger, detectTokenProgram, fetchTokenDecimals, formatTokenAmount } from "../../../../ccip-lib/svm";
import { TokenTransfer } from "./config-types";

/**
 * Validates that a wallet has sufficient SOL balance
 * 
 * @param connection Solana connection
 * @param walletPublicKey Wallet public key to check
 * @param minRequired Minimum required SOL amount
 * @param logger Logger instance
 * @returns True if the wallet has sufficient balance
 * @throws Error if balance is insufficient
 */
export async function validateSolBalance(
  connection: Connection,
  walletPublicKey: PublicKey,
  minRequired: number,
  logger: Logger
): Promise<boolean> {
  const solBalance = (await connection.getBalance(walletPublicKey)) / LAMPORTS_PER_SOL;
  logger.info(`SOL Balance: ${solBalance} SOL`);

  if (solBalance < minRequired) {
    logger.error(
      `⚠️ Not enough SOL for transaction. Have ${solBalance}, need at least ${minRequired} SOL`
    );
    throw new Error("Insufficient SOL balance for transaction fees");
  }

  return true;
}

/**
 * Validates token balances for all tokens being transferred
 * 
 * @param connection Solana connection
 * @param walletPublicKey Wallet public key to check
 * @param tokenTransfers Array of token transfers to validate
 * @param logger Logger instance
 * @returns True if all token balances are sufficient
 * @throws Error if any token balance is insufficient
 */
export async function validateTokenBalances(
  connection: Connection,
  walletPublicKey: PublicKey,
  tokenTransfers: TokenTransfer[],
  logger: Logger
): Promise<boolean> {
  // Skip validation if no tokens to transfer
  if (!tokenTransfers || tokenTransfers.length === 0) {
    return true;
  }

  logger.info("\n==== Token Balance Validation ====");
  
  for (const tokenTransfer of tokenTransfers) {
    const tokenMint = new PublicKey(tokenTransfer.tokenMint);
    const tokenAmount = tokenTransfer.amount.toString();

    // Get token program ID and decimals
    const tokenProgramId = await detectTokenProgram(
      tokenMint,
      connection,
      logger
    );

    const tokenDecimals = await fetchTokenDecimals(
      connection,
      tokenMint,
      tokenProgramId,
      logger
    );

    // Format for human-readable display
    const humanReadableAmount = formatTokenAmount(tokenAmount, tokenDecimals);
    logger.info(
      `Validating token ${tokenMint.toString()}: ${humanReadableAmount} tokens (${tokenAmount} raw units)`
    );

    // Get the user's token account
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      walletPublicKey,
      false,
      tokenProgramId
    );

    try {
      // Get token account data
      const tokenAccount = await getAccount(
        connection,
        userTokenAccount,
        undefined,
        tokenProgramId
      );

      const tokenBalance = new anchor.BN(tokenAccount.amount.toString());

      // Validate token balance
      if (tokenBalance.lt(new anchor.BN(tokenAmount))) {
        logger.error(
          `⚠️ Not enough ${tokenMint.toString()} tokens for transfer. Have ${tokenBalance.toString()} raw units, need ${tokenAmount} raw units (${humanReadableAmount} tokens)`
        );
        throw new Error(
          `Insufficient token balance for transfer: ${tokenMint.toString()}`
        );
      }

      logger.info(
        `✅ Balance validation passed for token: ${tokenMint.toString()}`
      );
    } catch (error) {
      logger.error(
        `Error validating token balance for ${tokenMint.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  logger.info("✅ All balance validations passed. Proceeding with transaction.");
  return true;
} 