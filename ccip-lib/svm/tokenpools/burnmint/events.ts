import { PublicKey } from "@solana/web3.js";
import { CCIPContext } from "../../core/models";
import { createLogger, Logger } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import {
  RemoteAddress,
  RateLimitConfig,
  RemoteAddressFields,
  RateLimitConfigFields,
} from "../../burnmint-pool-bindings/types";

/**
 * Event data for RemoteChainConfigured event using existing bindings types
 */
export interface RemoteChainConfiguredEvent {
  chainSelector: bigint;
  mint: PublicKey;
  token: RemoteAddressFields;
  previousToken: RemoteAddressFields;
  poolAddresses: RemoteAddressFields[];
  previousPoolAddresses: RemoteAddressFields[];
}

/**
 * Event data for RateLimitConfigured event using existing bindings types
 */
export interface RateLimitConfiguredEvent {
  chainSelector: bigint;
  mint: PublicKey;
  outboundRateLimit: RateLimitConfigFields;
  inboundRateLimit: RateLimitConfigFields;
}

/**
 * Event data for GlobalConfigUpdated event
 */
export interface GlobalConfigUpdatedEvent {
  selfServedAllowed: boolean;
}

/**
 * Union type for all burnmint pool events
 */
export type BurnMintPoolEvent =
  | { type: "RemoteChainConfigured"; data: RemoteChainConfiguredEvent }
  | { type: "RateLimitConfigured"; data: RateLimitConfiguredEvent }
  | { type: "GlobalConfigUpdated"; data: GlobalConfigUpdatedEvent };

/**
 * Event discriminators (hardcoded - would ideally come from IDL generation)
 */
const EVENT_DISCRIMINATORS = {
  RemoteChainConfigured: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]), // TODO: Get actual discriminator
  RateLimitConfigured: Buffer.from([8, 7, 6, 5, 4, 3, 2, 1]), // TODO: Get actual discriminator
  GlobalConfigUpdated: Buffer.from([9, 8, 7, 6, 5, 4, 3, 2]), // TODO: Get actual discriminator
} as const;

/**
 * Simple manual event parser for burnmint pool events
 * Uses existing bindings types instead of IDL-based parsing
 */
export class BurnMintPoolEventParser {
  private readonly logger: Logger;

  constructor(private readonly programId: PublicKey, context?: CCIPContext) {
    this.logger = context?.logger ?? createLogger("burnmint-pool-events");
  }

  /**
   * Parses events from transaction logs using manual parsing
   * @param logMessages Transaction log messages
   * @returns Array of parsed events
   */
  parseEvents(logMessages: string[]): BurnMintPoolEvent[] {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      const parsedEvents: BurnMintPoolEvent[] = [];

      // Look for "Program data: " logs from our program
      const programDataLogs = logMessages.filter(
        (log) =>
          log.includes("Program data: ") &&
          log.includes(this.programId.toString())
      );

      for (const log of programDataLogs) {
        try {
          const event = this.parseEventFromLog(log);
          if (event) {
            parsedEvents.push(event);
          }
        } catch (error) {
          this.logger.trace(`Failed to parse log as event: ${log}`, error);
        }
      }

      this.logger.debug(
        `Parsed ${parsedEvents.length} events from transaction logs`
      );
      return parsedEvents;
    } catch (error) {
      throw enhanceError(error, {
        operation: "parseEvents",
        programId: this.programId.toString(),
      });
    }
  }

  /**
   * Parses events from a transaction signature
   * @param context CCIP context with connection
   * @param txSignature Transaction signature
   * @returns Array of parsed events
   */
  async parseEventsFromTransaction(
    context: CCIPContext,
    txSignature: string
  ): Promise<BurnMintPoolEvent[]> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(`Fetching transaction details for: ${txSignature}`);

      const tx = await context.provider.connection.getTransaction(txSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta || !tx.meta.logMessages) {
        this.logger.warn(`No transaction logs found for ${txSignature}`);
        return [];
      }

      return this.parseEvents(tx.meta.logMessages);
    } catch (error) {
      throw enhanceError(error, {
        operation: "parseEventsFromTransaction",
        txSignature,
        programId: this.programId.toString(),
      });
    }
  }

  /**
   * Parses a specific RemoteChainConfigured event from transaction logs
   * @param logMessages Transaction log messages
   * @returns Parsed RemoteChainConfigured event or null
   */
  parseRemoteChainConfiguredEvent(
    logMessages: string[]
  ): RemoteChainConfiguredEvent | null {
    const events = this.parseEvents(logMessages);
    const configEvent = events.find((e) => e.type === "RemoteChainConfigured");
    return configEvent?.type === "RemoteChainConfigured"
      ? configEvent.data
      : null;
  }

  /**
   * Parses events from a transaction and returns RemoteChainConfigured event
   * @param context CCIP context
   * @param txSignature Transaction signature
   * @returns RemoteChainConfigured event data or null
   */
  async parseRemoteChainConfiguredFromTransaction(
    context: CCIPContext,
    txSignature: string
  ): Promise<RemoteChainConfiguredEvent | null> {
    const events = await this.parseEventsFromTransaction(context, txSignature);
    const configEvent = events.find((e) => e.type === "RemoteChainConfigured");
    return configEvent?.type === "RemoteChainConfigured"
      ? configEvent.data
      : null;
  }

  /**
   * Parse a single event from a program data log
   * @param log Program data log message
   * @returns Parsed event or null
   * @private
   */
  private parseEventFromLog(log: string): BurnMintPoolEvent | null {
    try {
      // Extract base64 data from "Program data: " log
      const parts = log.split("Program data: ");
      if (parts.length < 2) return null;

      const base64Data = parts[1].trim();
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length < 8) return null; // Need at least discriminator

      const discriminator = buffer.subarray(0, 8);

      // Check discriminator to determine event type
      // NOTE: These discriminators need to be determined from the actual program
      // For now, we'll implement a simple fallback that logs the discriminator
      this.logger.trace(
        `Event discriminator: ${discriminator.toString("hex")}`
      );

      // TODO: Implement proper discriminator matching once we have the actual values
      // For now, return null and log the discriminator for investigation
      this.logger.debug(
        `Found potential event with discriminator: ${discriminator.toString(
          "hex"
        )}`
      );

      return null;
    } catch (error) {
      this.logger.trace(`Failed to parse event from log: ${error}`);
      return null;
    }
  }
}

/**
 * Creates a BurnMintPoolEventParser instance
 * @param programId Program ID
 * @param context Optional CCIP context
 * @returns Event parser instance
 */
export function createBurnMintPoolEventParser(
  programId: PublicKey,
  context?: CCIPContext
): BurnMintPoolEventParser {
  return new BurnMintPoolEventParser(programId, context);
}
