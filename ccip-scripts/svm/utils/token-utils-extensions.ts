import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { Connection, PublicKey, Keypair, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { createLogger } from '../../../ccip-lib/svm/utils/logger';

const logger = createLogger('TokenUtils');

/**
 * Gets or creates an associated token account
 */
export async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: PublicKey | Keypair,
  mint: PublicKey,
  owner: PublicKey = payer instanceof Keypair ? payer.publicKey : payer,
  keypair?: Keypair
): Promise<{
  address: PublicKey;
  created: boolean;
}> {
  // Get the payer public key
  const payerPublicKey = payer instanceof Keypair ? payer.publicKey : payer;
  
  const associatedTokenAddress = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Check if the token account already exists
  try {
    const tokenAccount = await connection.getAccountInfo(associatedTokenAddress);
    if (tokenAccount) {
      logger.debug(`Associated token account ${associatedTokenAddress.toString()} already exists`);
      return {
        address: associatedTokenAddress,
        created: false,
      };
    }
  } catch (error) {
    logger.debug(`Error checking token account: ${error instanceof Error ? error.message : String(error)}`);
  }

  // If the account doesn't exist, create it
  if (keypair) {
    logger.info(`Creating associated token account ${associatedTokenAddress.toString()}`);
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payerPublicKey,
        associatedTokenAddress,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
    logger.debug(`Created token account. Tx: ${signature}`);
  } else {
    logger.info(`Token account ${associatedTokenAddress.toString()} doesn't exist, but no keypair provided to create it`);
  }

  return {
    address: associatedTokenAddress,
    created: true,
  };
} 