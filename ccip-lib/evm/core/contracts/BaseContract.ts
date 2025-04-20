import { ethers } from "ethers";
import {
  CCIPEVMContext,
  CCIPEVMReadProvider,
  CCIPEVMWriteProvider,
  Logger,
} from "../models";
import { createLogger, LogLevel } from "../../utils/logger";

/**
 * Base class for all contract-specific clients
 */
export abstract class BaseContract {
  protected readonly context: CCIPEVMContext;
  protected readonly _logger: Logger;

  /**
   * Creates a new contract client with the provided context
   * 
   * @param context Client context with provider, config, and logger
   * @param loggerName Name for the logger instance
   */
  constructor(context: CCIPEVMContext, loggerName: string) {
    // Initialize context with default logger if not provided
    this.context = {
      provider: context.provider,
      config: context.config,
      logger:
        context.logger ??
        createLogger(loggerName, { level: LogLevel.INFO }),
      confirmations: context.confirmations,
    };

    // Ensure logger is always available
    this._logger =
      this.context.logger ??
      createLogger(loggerName, { level: LogLevel.INFO });
  }

  /**
   * Gets the provider from the context
   */
  get provider() {
    return this.context.provider;
  }

  /**
   * Gets the configuration from the context
   */
  get config() {
    return this.context.config;
  }

  /**
   * Gets the logger from the context
   */
  get logger(): Logger {
    return this._logger;
  }

  /**
   * Checks if the current provider has signing capabilities
   * @returns True if the provider can sign transactions
   */
  protected hasSigningCapabilities(): boolean {
    return "signer" in this.context.provider;
  }

  /**
   * Gets the signer if available, throws an error otherwise
   * @throws Error if the provider doesn't have signing capabilities
   * @returns The signer
   */
  protected getSigner(): ethers.Signer {
    if (!this.hasSigningCapabilities()) {
      throw new Error(
        "This operation requires signing capabilities. Initialize the client with a signer."
      );
    }
    return (this.context.provider as CCIPEVMWriteProvider).signer;
  }

  /**
   * Gets an address from the signer if available
   * @throws Error if the provider doesn't have signing capabilities
   * @returns The signer's address
   */
  protected async getSignerAddress(): Promise<string> {
    if (!this.hasSigningCapabilities()) {
      throw new Error(
        "This operation requires a signer address. Initialize the client with a signer."
      );
    }
    return (this.context.provider as CCIPEVMWriteProvider).getAddress();
  }

  /**
   * Waits for a transaction to be confirmed with the configured number of confirmations
   * 
   * @param tx Transaction response to wait for
   * @param customConfirmations Optional override for the number of confirmations
   * @returns Transaction receipt after confirmations
   */
  protected async waitForTransaction(
    tx: ethers.TransactionResponse, 
    customConfirmations?: number
  ): Promise<ethers.TransactionReceipt> {
    // Get confirmation count from: custom param > context > config > default (3)
    const confirmations = customConfirmations ?? 
      this.context.confirmations ?? 
      (this.context.config as any).confirmations ?? 
      3;
    
    this._logger.debug(`Transaction ${tx.hash} sent, waiting for ${confirmations} confirmations...`);
    return await tx.wait(confirmations);
  }
} 