import { TransactionInstruction, Connection, Keypair, PublicKey } from "@solana/web3.js";
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
  CCIPClientKeypairOptions,
} from "../models";
import * as types from "../../bindings/types";
import { loadKeypair } from "../../utils/keypair";

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
   * Creates a new CCIP client from configuration and keypair
   * @param options Configuration options including keypair path and config
   * @returns A new CCIPClient instance
   */
  static createFromKeypair(options: CCIPClientKeypairOptions): CCIPClient {
    // Load keypair
    const wallet = loadKeypair(options.keypairPath);
    
    // Create connection
    const connection = new Connection(
      options.endpoint || "https://api.devnet.solana.com",
      options.commitment as any || "confirmed"
    );
    
    // Create provider
    const provider: CCIPProvider = {
      connection,
      wallet,
      getAddress: () => wallet.publicKey,
      signTransaction: async (tx) => {
        if ('version' in tx) {
          // VersionedTransaction
          tx.sign([wallet]);
        } else {
          // Legacy Transaction
          tx.partialSign(wallet);
        }
        return tx;
      },
    };
    
    // Create context
    const context: CCIPContext = {
      provider,
      config: options.config,
      logger: createLogger("ccip-client", { level: options.logLevel ?? LogLevel.INFO }),
    };
    
    return new CCIPClient(context);
  }

  /**
   * Creates a new CCIP client from simplified configuration
   * This is a convenience method that accepts a partial config and fills in defaults
   * @param connection Solana connection
   * @param wallet Keypair for signing
   * @param config Partial configuration (only required fields needed)
   * @param options Optional client options
   * @returns A new CCIPClient instance
   */
  static create(
    connection: Connection,
    wallet: Keypair,
    config: {
      ccipRouterProgramId: string;
      feeQuoterProgramId: string;
      rmnRemoteProgramId: string;
      linkTokenMint?: string;
      tokenMint?: string;
      receiverProgramId?: string;
    },
    options?: { logLevel?: LogLevel }
  ): CCIPClient {
    // Create provider
    const provider: CCIPProvider = {
      connection,
      wallet,
      getAddress: () => wallet.publicKey,
      signTransaction: async (tx) => {
        if ('version' in tx) {
          tx.sign([wallet]);
        } else {
          tx.partialSign(wallet);
        }
        return tx;
      },
    };

    // Build core config with defaults
    const coreConfig: CCIPCoreConfig = {
      ccipRouterProgramId: new PublicKey(config.ccipRouterProgramId),
      feeQuoterProgramId: new PublicKey(config.feeQuoterProgramId),
      rmnRemoteProgramId: new PublicKey(config.rmnRemoteProgramId),
      linkTokenMint: new PublicKey(config.linkTokenMint || "LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L"),
      tokenMint: new PublicKey(config.tokenMint || "11111111111111111111111111111111"),
      nativeSol: PublicKey.default,
      systemProgramId: new PublicKey("11111111111111111111111111111111"),
      programId: new PublicKey(config.receiverProgramId || "BqmcnLFSbKwyMEgi7VhVeJCis1wW26VySztF34CJrKFq"),
    };

    // Create context
    const context: CCIPContext = {
      provider,
      config: coreConfig,
      logger: createLogger("ccip-client", { level: options?.logLevel ?? LogLevel.INFO }),
    };

    return new CCIPClient(context);
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
