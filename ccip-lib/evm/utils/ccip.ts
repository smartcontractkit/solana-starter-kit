import { ethers } from "ethers";
import { OnRamp__factory } from "../types/contracts/factories/OnRamp__factory";
import { CCIPMessageSentEvent, Internal } from "../types/contracts/OnRamp";

/**
 * Generic extra args V2 tag
 */
export const GENERIC_EXTRA_ARGS_V2_TAG = "0x181dcf10";

/**
 * Extracts CCIP message information from a transaction receipt
 *
 * @param receipt Transaction receipt containing CCIP events
 * @returns The extracted CCIP message or null if not found
 */
export function extractCCIPMessageFromReceipt(
  receipt: ethers.TransactionReceipt
): Internal.EVM2AnyRampMessageStructOutput | null {
  if (!receipt || !receipt.logs) {
    return null;
  }

  // Create OnRamp contract interface from generated types
  const onRampInterface = OnRamp__factory.createInterface();

  // Loop through each log to find CCIPMessageSent event
  for (const log of receipt.logs) {
    try {
      // Try to parse the log
      const parsedLog = onRampInterface.parseLog(log);

      // Check if it's a CCIPMessageSent event
      if (parsedLog && parsedLog.name === "CCIPMessageSent") {
        // Cast to the proper type that matches the event structure
        const typedLog =
          parsedLog as unknown as CCIPMessageSentEvent.LogDescription;
        const message = typedLog.args.message;

        // Validate the message data
        if (!message || !message.header || !message.header.messageId) {
          continue;
        }

        return message;
      }
    } catch (error) {
      // Not a CCIPMessageSent event or failed to parse, continue to next log
      continue;
    }
  }

  return null;
}

/**
 * Gets the message status string representation
 *
 * @param state Numeric message status
 * @returns Human-readable message status
 */
export function getMessageStatusString(state: number): string {
  switch (state) {
    case 0:
      return "UNTRIGGERED";
    case 1:
      return "IN_PROGRESS";
    case 2:
      return "SUCCESS";
    case 3:
      return "FAILURE";
    default:
      return "UNKNOWN";
  }
}

/**
 * Creates a delay function
 *
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after specified time
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
