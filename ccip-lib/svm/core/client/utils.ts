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
  
  // If no options provided, create a default buffer with allowOutOfOrderExecution=true
  if (!options) {
    if (logger) {
      logger.warn(`No options provided, creating default extraArgs with allowOutOfOrderExecution=true to avoid error 8030`);
    }
    
    // Use the GENERIC_EXTRA_ARGS_V2_TAG which is bytes4(keccak256("CCIP EVMExtraArgsV2"))
    const typeTag = Buffer.from([0x18, 0x1d, 0xcf, 0x10]);
    
    // Default gas limit of 0 in little-endian format (16 bytes)
    const gasLimitLE = Buffer.alloc(16, 0);
    
    // Boolean true (1) for allowOutOfOrderExecution
    const allowOutOfOrderExecutionByte = Buffer.from([1]);
    
    // Concatenate for a properly formatted default buffer
    const argsData = Buffer.concat([gasLimitLE, allowOutOfOrderExecutionByte]);
    const result = Buffer.concat([typeTag, argsData]);
    
    if (logger) {
      logger.trace(`Created default extraArgs buffer with allowOutOfOrderExecution=true`);
    }
    
    return result;
  }

  // Get values from options with defaults
  const gasLimit = options.gasLimit || 0;
  
  // Handle the three cases for allowOutOfOrderExecution:
  // 1. Undefined - we'll use true but inform the user
  // 2. Explicitly false - we'll override to true with warning
  // 3. Explicitly true - we'll use it as is
  
  let warningMessage: string | null = null;
  
  if (options.allowOutOfOrderExecution === undefined) {
    // If undefined, we'll use true but log a message about the default behavior
    warningMessage = `allowOutOfOrderExecution not specified, defaulting to true to avoid FeeQuoter error 8030`;
  } else if (options.allowOutOfOrderExecution === false) {
    // If explicitly false, we'll override it with a warning
    warningMessage = `allowOutOfOrderExecution=false was explicitly specified but is not supported by FeeQuoter. Forcing to true to avoid error 8030.`;
  }
  
  // Log warning if needed
  if (warningMessage && logger) {
    logger.warn(warningMessage);
  }
  
  // Always use true regardless of what was specified
  const allowOutOfOrderExecution = true;
  
  // Log what we're doing
  if (logger) {
    const forcedMsg = options.allowOutOfOrderExecution === false ? ' (forced)' : 
                      options.allowOutOfOrderExecution === undefined ? ' (default)' : '';
    logger.debug(`ExtraArgs options - gasLimit: ${gasLimit}, allowOutOfOrderExecution: true${forcedMsg}`);
  }

  // Use the GENERIC_EXTRA_ARGS_V2_TAG which is bytes4(keccak256("CCIP EVMExtraArgsV2"))
  // 0x181dcf10 in big-endian format
  const typeTag = Buffer.from([0x18, 0x1d, 0xcf, 0x10]);
  if (logger) {
    logger.trace(`Using EVM ExtraArgs V2 type tag: 0x181dcf10`);
  }

  // Now we need to construct the serialized version of GenericExtraArgsV2
  // Based on Anchor's serialization format:
  // 1. gas_limit (u128) - 16 bytes
  // 2. allow_out_of_order_execution (bool) - 1 byte (1 = true, 0 = false)
  
  // Convert gas limit to little-endian bytes (Anchor uses little endian)
  const gasLimitLE = new BN(gasLimit).toArrayLike(Buffer, 'le', 16);
  
  if (logger) {
    logger.trace(`Gas limit buffer (LE, 16 bytes): 0x${gasLimitLE.toString('hex')}`);
  }

  // Create bool byte for allowOutOfOrderExecution - ALWAYS true (1)
  const allowOutOfOrderExecutionByte = Buffer.from([1]);
  
  if (logger) {
    logger.trace(`AllowOutOfOrderExecution byte: 0x01 (true)`);
  }

  // Concatenate for the data part: gasLimit (LE) + allowOutOfOrderExecution
  const argsData = Buffer.concat([gasLimitLE, allowOutOfOrderExecutionByte]);
  
  // Final buffer is tag + serialized args
  const result = Buffer.concat([typeTag, argsData]);
  
  if (logger) {
    logger.trace(`Final extraArgs buffer (${result.length} bytes): 0x${result.toString('hex')}`);
  }
  
  return result;
} 