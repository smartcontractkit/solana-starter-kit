import { TransactionInstruction } from "@solana/web3.js";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import {
  CCIPContext,
  CCIPSendRequest,
  CCIPSendOptions,
  CCIPFeeRequest,
  CCIPSendResult,
  ExtraArgsOptions,
  CCIPCoreConfig,
  CCIPProvider,
} from "../models";
import * as types from "../../bindings/types";

// Import functionality from separate modules
import { calculateFee } from "./fee";
import { parseCCIPMessageSentEvent } from "./events";
import { createExtraArgs } from "./utils";
import { sendCCIPMessage } from "./send";
import { CCIPAccountReader } from "./accounts";

/**
 * Main client class for interacting with CCIP on Solana
 *
 * Features:
 * - Message sending with optional skipPreflight for low compute limit transactions
 * - Fee calculation for CCIP messages
 * - Message ID parsing from transaction results
 * - ExtraArgs generation for cross-chain messages
 */
export class CCIPClient {
  private readonly context: CCIPContext;
  private readonly accountReader: CCIPAccountReader;

  /**
   * Creates a new CCIP client with context
   * @param context CCIPContext containing provider, config, and logger
   */
  constructor(context: CCIPContext) {
    // Initialize context
    this.context = {
      provider: context.provider,
      config: context.config,
      logger:
        context.logger ?? createLogger("client", { level: LogLevel.INFO }),
    };

    // Initialize account reader with the same context
    this.accountReader = new CCIPAccountReader(this.context);
  }

  /**
   * Get the provider for this client
   */
  get provider(): CCIPProvider {
    return this.context.provider;
  }

  /**
   * Get the configuration for this client
   */
  get config(): CCIPCoreConfig {
    return this.context.config;
  }

  /**
   * Get the logger for this client
   */
  get logger(): Logger {
    return this.context.logger;
  }

  /**
   * Get the account reader for this client
   */
  getAccountReader(): CCIPAccountReader {
    return this.accountReader;
  }

  /**
   * Calculates the fee for a CCIP message
   * @param request Fee request
   * @returns Fee result
   */
  async getFee(request: CCIPFeeRequest): Promise<types.GetFeeResult> {
    return calculateFee(this.context, request);
  }

  /**
   * Sends a CCIP message
   * @param request Send request
   * @param computeBudgetInstruction Optional compute budget instruction
   * @param sendOptions Optional send options (skipPreflight, etc.)
   * @returns Transaction signature
   */
  async send(
    request: CCIPSendRequest,
    computeBudgetInstruction?: TransactionInstruction,
    sendOptions?: CCIPSendOptions
  ): Promise<string> {
    return sendCCIPMessage(
      this.context,
      request,
      this.accountReader,
      computeBudgetInstruction,
      sendOptions
    );
  }

  /**
   * Sends a CCIP message and returns the message ID
   * @param request Send request
   * @param computeBudgetInstruction Optional compute budget instruction
   * @param sendOptions Optional send options (skipPreflight, etc.)
   * @returns Send result with transaction signature and message ID
   */
  async sendWithMessageId(
    request: CCIPSendRequest,
    computeBudgetInstruction?: TransactionInstruction,
    sendOptions?: CCIPSendOptions
  ): Promise<CCIPSendResult> {
    const txSignature = await this.send(
      request,
      computeBudgetInstruction,
      sendOptions
    );

    // Parse the CCIPMessageSent event to get the messageId
    const eventData = await parseCCIPMessageSentEvent(
      this.context,
      txSignature
    );

    return {
      txSignature,
      messageId: eventData.messageId,
    };
  }

  /**
   * Creates the extra arguments for a CCIP message
   * @param options Options for creating extra arguments
   * @returns Extra arguments buffer
   */
  createExtraArgs(options?: ExtraArgsOptions): Buffer {
    return createExtraArgs(options, this.context.logger);
  }
}
