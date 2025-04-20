import { ethers } from "ethers";
import { Logger } from "../core/models";

/**
 * Options for batch transaction operations
 */
export interface BatchOptions {
  /** Delay between operations in milliseconds (default: 2000ms) */
  delayMs?: number;
  
  /** Whether to continue on error (default: false) */
  continueOnError?: boolean;

  /** Custom callback function for progress updates */
  onProgress?: (index: number, total: number, receipt?: ethers.TransactionReceipt, error?: Error) => void;
}

/**
 * Result of batch operations
 */
export interface BatchResult {
  /** Total number of operations attempted */
  totalOperations: number;
  
  /** Number of successful operations */
  successfulOperations: number;
  
  /** Number of failed operations */
  failedOperations: number;
  
  /** Transaction receipts from successful operations */
  receipts: ethers.TransactionReceipt[];
  
  /** Error messages from failed operations */
  errors: string[];
}

/**
 * Type for an operation function that returns a transaction receipt
 */
export type TransactionOperation<T extends any[]> = (...args: T) => Promise<ethers.TransactionReceipt>;

/**
 * Executes a batch of identical operations with the same parameters
 * 
 * @param operation Function to execute for each operation
 * @param count Number of times to execute the operation
 * @param args Arguments to pass to each operation
 * @param logger Logger instance for tracking progress
 * @param options Batch operation options
 * @returns Result of the batch operation
 */
export async function executeBatch<T extends any[]>(
  operation: TransactionOperation<T>,
  count: number,
  args: T,
  logger: Logger,
  options: BatchOptions = {}
): Promise<BatchResult> {
  const {
    delayMs = 2000,
    continueOnError = false,
    onProgress
  } = options;

  // Create result object
  const result: BatchResult = {
    totalOperations: count,
    successfulOperations: 0,
    failedOperations: 0,
    receipts: [],
    errors: []
  };
  
  // Helper function for delay between operations
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  logger.info(`Starting batch operation: ${count} operations`);
  
  // Execute operations
  for (let i = 0; i < count; i++) {
    logger.info(`[${i + 1}/${count}] Executing operation...`);
    
    try {
      // Execute transaction
      const receipt = await operation(...args);
      
      // Log success
      logger.info(`✓ Operation ${i + 1}/${count} successful (Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed})`);
      
      // Update counters and store receipt
      result.successfulOperations++;
      result.receipts.push(receipt);
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(i + 1, count, receipt);
      }
    } catch (error) {
      // Log error
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`✗ Operation ${i + 1}/${count} failed: ${errorMessage}`);
      
      // Update counters and error list
      result.failedOperations++;
      result.errors.push(errorMessage);
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(i + 1, count, undefined, error instanceof Error ? error : new Error(errorMessage));
      }
      
      // Stop if we shouldn't continue on error
      if (!continueOnError) {
        logger.warn(`Stopping batch operation after failure (${i + 1}/${count} completed)`);
        break;
      }
    }
    
    // Add delay between operations if not the last one
    if (i < count - 1) {
      logger.debug(`Waiting ${delayMs}ms before next operation...`);
      await delay(delayMs);
    }
  }
  
  // Log summary
  logger.info(`Batch operation completed: ${result.successfulOperations}/${count} successful`);
  
  if (result.failedOperations > 0) {
    logger.warn(`${result.failedOperations} operations failed during batch operation`);
  }
  
  return result;
}

/**
 * Calculates the gas used by batch operations
 * 
 * @param result Batch operation result
 * @returns Total gas used by successful operations
 */
export function calculateTotalGasUsed(result: BatchResult): bigint {
  return result.receipts.reduce(
    (total, receipt) => total + receipt.gasUsed,
    BigInt(0)
  );
}

/**
 * Formats a summary of a batch operation
 * 
 * @param result Batch operation result
 * @returns Formatted summary string
 */
export function formatBatchSummary(result: BatchResult): string {
  const totalGas = calculateTotalGasUsed(result);
  
  let summary = [
    `Total operations: ${result.totalOperations}`,
    `Successful: ${result.successfulOperations}`,
    `Failed: ${result.failedOperations}`,
    `Total gas used: ${totalGas.toString()}`
  ].join('\n');
  
  if (result.errors.length > 0) {
    summary += '\n\nErrors:\n' + result.errors.map((err, i) => 
      `  ${i + 1}. ${err}`
    ).join('\n');
  }
  
  return summary;
} 