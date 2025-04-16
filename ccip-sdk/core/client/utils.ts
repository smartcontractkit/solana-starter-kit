import { Logger } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import { createLogger, LogLevel } from "../../utils/logger";
import { ExtraArgsOptions, ExtraArgsV1 } from "../models";
import { BN } from "@coral-xyz/anchor";

/**
 * Creates extra arguments for CCIP send
 * @param options Extra args options
 * @param logger Optional logger instance
 * @returns Buffer with encoded extra args
 */
export function createExtraArgs(
  options?: ExtraArgsOptions,
  logger?: Logger
): Buffer {
  if (logger) {
    logger.debug(`Creating extraArgs buffer for CCIP message`);
  }
  
  // If no options provided, return empty buffer
  if (!options) {
    if (logger) {
      logger.debug(`No options provided, returning empty buffer`);
    }
    return Buffer.alloc(0);
  }

  // Get values from options with defaults
  const gasLimit = options.gasLimit || 0;
  const strict = !options?.allowOutOfOrderExecution;
  
  if (logger) {
    logger.debug(`ExtraArgs options - gasLimit: ${gasLimit}, strict execution: ${strict}`);
  }

  // Use the GENERIC_EXTRA_ARGS_V2_TAG which is bytes4(keccak256("CCIP EVMExtraArgsV2"))
  // 0x181dcf10 in big-endian format
  const typeTag = Buffer.from([0x18, 0x1d, 0xcf, 0x10]);
  if (logger) {
    logger.trace(`Using EVM ExtraArgs V2 type tag: 0x181dcf10`);
  }

  // Convert gas limit to buffer
  const gasLimitBuffer = Buffer.from(new BN(gasLimit).toArray("be", 32));
  if (logger) {
    logger.trace(`Gas limit buffer (32 bytes): 0x${gasLimitBuffer.toString('hex')}`);
  }

  // Create flag byte for strict execution (0x00 for strict, 0x01 for allowing out of order)
  const flagsByte = strict ? Buffer.from([0]) : Buffer.from([1]);
  if (logger) {
    logger.trace(`Flags byte: ${strict ? '0x00 (strict)' : '0x01 (allow out of order)'}`);
  }

  // Concatenate all parts
  const result = Buffer.concat([typeTag, gasLimitBuffer, flagsByte]);
  if (logger) {
    logger.trace(`Final extraArgs buffer (${result.length} bytes): 0x${result.toString('hex')}`);
  }
  
  return result;
} 