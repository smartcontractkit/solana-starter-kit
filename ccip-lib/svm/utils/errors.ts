import { Logger } from "./logger";

/**
 * Base CCIP error class for standardized error handling
 */
export class CCIPError extends Error {
  constructor(message: string, public context?: Record<string, unknown>) {
    super(message);
    this.name = "CCIPError";
  }
}

/**
 * Enhances an error with additional context for better diagnostics
 * @param error Original error
 * @param context Additional context to add
 * @param logger Optional logger instance
 * @returns Enhanced error with context attached
 */
export function enhanceError(
  error: unknown,
  context: Record<string, unknown>,
  logger?: Logger
): Error {
  const enhancedError =
    error instanceof Error ? error : new Error(String(error));

  // Attach context to the error
  (enhancedError as any).context = context;

  // Log the enhanced error if a logger is provided
  if (logger) {
    logger.error(`Error: ${enhancedError.message}`, {
      context,
      stack: enhancedError.stack,
    });
  }

  return enhancedError;
}

/**
 * Creates a type-safe error enhancer bound to a specific logger instance
 * @param logger Logger instance to use for error logging
 * @returns A function that enhances errors with context
 */
export function createErrorEnhancer(logger: Logger) {
  return (error: unknown, context: Record<string, unknown>): Error => {
    return enhanceError(error, context, logger);
  };
} 