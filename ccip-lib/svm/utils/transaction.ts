import {
  Commitment,
  Connection,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { CCIPContext } from "../core/models";
import { TxOptions } from "../tokenpools/abstract";
import { createErrorEnhancer } from "./errors";
import { Logger } from "./logger";

/**
 * Extended options for transaction execution that includes error context
 */
export interface TransactionExecutionOptions extends TxOptions {
  /**
   * Optional context information to include in error messages
   * This helps pinpoint the source and details of transaction failures
   */
  errorContext?: Record<string, string>;

  /**
   * Optional operation name for logging and error reporting
   */
  operationName?: string;
}

/**
 * Extracts transaction options from various input structures
 * Handles both nested txOptions and direct transaction parameters
 *
 * @param options Any object that might contain transaction options
 * @returns Normalized TxOptions or undefined if no options found
 */
export function extractTxOptions(options?: any): TxOptions | undefined {
  if (!options) {
    return undefined;
  }

  // If the options object has a txOptions property, use that
  if (options.txOptions) {
    return options.txOptions;
  }

  // If the options object itself has tx option properties, extract those
  const txOptions: TxOptions = {};

  // Check for and copy over common tx option properties
  if (options.skipPreflight !== undefined)
    txOptions.skipPreflight = options.skipPreflight;
  if (options.preflightCommitment !== undefined)
    txOptions.preflightCommitment = options.preflightCommitment;
  if (options.maxRetries !== undefined)
    txOptions.maxRetries = options.maxRetries;
  if (options.commitment !== undefined)
    txOptions.commitment = options.commitment;
  if (options.confirmationCommitment !== undefined)
    txOptions.confirmationCommitment = options.confirmationCommitment;

  // Return undefined if no tx options were found
  return Object.keys(txOptions).length > 0 ? txOptions : undefined;
}

/**
 * Executes a transaction with the given instructions
 * Handles the entire transaction lifecycle: creation, signing, sending, and confirmation
 *
 * @param context CCIP context with provider and connection
 * @param instructions Array of transaction instructions to execute
 * @param options Transaction execution options including commitment levels and error context
 * @returns Transaction signature
 */
export async function executeTransaction(
  context: CCIPContext,
  instructions: TransactionInstruction[],
  options?: TransactionExecutionOptions
): Promise<string> {
  const logger =
    context.logger ||
    ({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    } as Logger);
  const connection = context.provider.connection;
  const txOptions = extractTxOptions(options);

  // Setup error enhancement
  const errorContext = options?.errorContext || {};
  const operationName = options?.operationName || "executeTransaction";
  const enhanceError = createErrorEnhancer(logger);

  try {
    logger.debug(
      `Starting transaction execution${
        operationName ? ` for ${operationName}` : ""
      }`
    );

    // Get the latest blockhash with configured commitment
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash({
        commitment: txOptions?.commitment ?? "finalized",
      });

    // Create transaction with the instructions
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = context.provider.getAddress();

    // Add all instructions to the transaction
    for (const instruction of instructions) {
      transaction.add(instruction);
    }

    // Sign the transaction
    const signedTx = await context.provider.signTransaction(transaction);

    // Send the transaction with configurable options
    const signature = await connection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: txOptions?.skipPreflight ?? false,
        preflightCommitment:
          txOptions?.preflightCommitment ?? ("processed" as Commitment),
        maxRetries: txOptions?.maxRetries ?? 5,
      }
    );

    logger.debug(`Transaction sent: ${signature}`);

    // Wait for transaction confirmation
    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      txOptions?.confirmationCommitment ?? ("finalized" as Commitment)
    );

    logger.debug(`Transaction confirmed: ${signature}`);
    return signature;
  } catch (error) {
    throw enhanceError(error, {
      operation: operationName,
      ...errorContext,
    });
  }
}
