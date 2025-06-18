import { createErrorEnhancer } from "../../utils/errors";
import { CCIPContext } from "../models";

/**
 * Parses a CCIP message sent event from a transaction
 *
 * @param context SDK context with provider, config and logger
 * @param txSignature Transaction signature
 * @returns Parsed event data with messageId if available
 */
export async function parseCCIPMessageSentEvent(
  context: CCIPContext,
  txSignature: string
): Promise<{
  messageId?: string;
}> {
  if (!context.logger) {
    throw new Error("Logger is required for parseCCIPMessageSentEvent");
  }

  const logger = context.logger;
  const config = context.config;
  const connection = context.provider.connection;

  const enhanceError = createErrorEnhancer(logger);

  try {
    logger.info(
      `Parsing CCIP message sent event for transaction: ${txSignature}`
    );

    // Get transaction details with logs
    logger.debug(`Fetching transaction details with logs`);
    const tx = await connection.getParsedTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta || !tx.meta.logMessages) {
      logger.warn(`No transaction logs found for ${txSignature}`);
      return { messageId: undefined };
    }

    // Get the router program ID as string for comparison
    const routerProgramId = config.ccipRouterProgramId.toString();
    logger.debug(
      `Looking for program return log from CCIP Router: ${routerProgramId}`
    );

    // Log messages in TRACE mode
    logger.trace("Transaction logs:", tx.meta.logMessages);

    // Look for the program return log from the CCIP Router program
    const programReturnLog = tx.meta.logMessages.find((log) =>
      log.includes(`Program return: ${routerProgramId}`)
    );

    if (programReturnLog) {
      logger.debug(`Found CCIP program return log`);

      // Extract the base64 data after the program ID
      const parts = programReturnLog.split(
        `Program return: ${routerProgramId} `
      );
      if (parts.length > 1) {
        const base64Data = parts[1].trim();
        logger.trace(`Extracted base64 data: ${base64Data}`);

        const buffer = Buffer.from(base64Data, "base64");

        // The buffer should contain the messageId (32 bytes)
        const messageIdHex = "0x" + buffer.toString("hex");
        logger.info(`Successfully extracted messageId: ${messageIdHex}`);

        return {
          messageId: messageIdHex,
        };
      }
    }

    logger.warn(
      `Could not find CCIP Router program return log in transaction logs`
    );
    return { messageId: undefined };
  } catch (error) {
    enhanceError(new Error(`Failed to parse message ID from transaction`), {
      operation: "parseCCIPMessageSentEvent",
      txSignature,
      error: error instanceof Error ? error.message : String(error),
    });
    return { messageId: undefined };
  }
}
