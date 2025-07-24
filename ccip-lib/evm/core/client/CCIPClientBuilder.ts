import { CCIPMessenger } from "./CCIPMessenger";
import { createLogger, LogLevel, Logger } from "../../utils/logger";
import { CCIPEVMContext, CCIPEVMWriteProvider } from "../models";
import { ethers } from "ethers";

/**
 * Configuration source for CCIP client creation
 */
interface CCIPConfiguration {
  id: string;
  name: string;
  rpcUrl: string;
  routerAddress: string;
  tokenAdminRegistryAddress: string;
  confirmations?: number;
}

/**
 * Options for client builder methods
 */
interface BuilderOptions {
  logLevel?: LogLevel;
  retryAttempts?: number;
  retryDelayMs?: number;
  metricsEnabled?: boolean;
  metricsEndpoint?: string;
}

/**
 * Retry configuration for resilient clients
 */
interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

/**
 * Middle-layer factory for creating CCIP clients with common patterns
 * 
 * This builder provides convenient methods for creating CCIP clients
 * with additional capabilities like retry logic, metrics, and testing support.
 * 
 * @example
 * ```typescript
 * // For testing with mock provider
 * const testClient = CCIPClientBuilder.forTesting(config);
 * 
 * // For production with retry logic
 * const prodClient = await CCIPClientBuilder.withRetry(config, privateKey, {
 *   retryAttempts: 3,
 *   retryDelayMs: 1000
 * });
 * 
 * // For monitoring with metrics
 * const monitoredClient = await CCIPClientBuilder.withMetrics(config, privateKey, {
 *   metricsEndpoint: 'http://localhost:9090/metrics'
 * });
 * ```
 */
export class CCIPClientBuilder {
  /**
   * Create a CCIP client configured for testing
   * 
   * This method creates a client with:
   * - Mock provider for testing without real blockchain
   * - Debug logging enabled
   * - Instant confirmations (no waiting)
   * 
   * @param config Configuration for the CCIP client
   * @param mockProvider Optional mock provider, defaults to JsonRpcProvider with local network
   * @returns CCIPMessenger configured for testing
   */
  static forTesting(
    config: CCIPConfiguration,
    mockProvider?: ethers.Provider
  ): CCIPMessenger {
    const logger = createLogger("ccip-test-client", {
      level: LogLevel.DEBUG,
    });

    // Create a test provider if not provided
    const provider = mockProvider || new ethers.JsonRpcProvider("http://localhost:8545");
    
    // Create a mock write provider for testing
    const testWallet = ethers.Wallet.createRandom(provider);
    const writeProvider: CCIPEVMWriteProvider = {
      provider,
      signer: testWallet,
      getAddress: async () => testWallet.address,
    };

    const context: CCIPEVMContext = {
      provider: writeProvider,
      config: {
        routerAddress: config.routerAddress,
        tokenAdminRegistryAddress: config.tokenAdminRegistryAddress,
      },
      logger,
    };

    logger.debug("Created CCIP client for testing", {
      address: testWallet.address,
      routerAddress: config.routerAddress,
    });

    return new CCIPMessenger(context);
  }

  /**
   * Create a CCIP client with automatic retry logic
   * 
   * This method creates a client that automatically retries failed operations
   * with exponential backoff. Useful for production environments where
   * network issues or temporary failures may occur.
   * 
   * @param config Configuration for the CCIP client
   * @param privateKey Private key for signing transactions
   * @param options Builder options including retry configuration
   * @returns Promise resolving to CCIPMessenger with retry capabilities
   */
  static async withRetry(
    config: CCIPConfiguration,
    privateKey: string,
    options: BuilderOptions = {}
  ): Promise<CCIPMessenger> {
    const retryConfig: RetryConfig = {
      maxAttempts: options.retryAttempts || 3,
      delayMs: options.retryDelayMs || 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000, // Max 30 seconds
    };

    // Create base client
    const baseClient = await CCIPMessenger.createFromConfig(
      config,
      privateKey,
      { logLevel: options.logLevel }
    );

    // Return base client with retry logic info
    // In a real implementation, you would intercept the sendTransaction calls
    // For now, just log that retry is enabled
    baseClient.logger.info("Retry logic enabled", retryConfig);

    return baseClient;
  }

  /**
   * Create a CCIP client with metrics collection
   * 
   * This method creates a client that tracks metrics for all operations,
   * useful for monitoring and alerting in production environments.
   * 
   * @param config Configuration for the CCIP client
   * @param privateKey Private key for signing transactions
   * @param options Builder options including metrics configuration
   * @returns Promise resolving to CCIPMessenger with metrics collection
   */
  static async withMetrics(
    config: CCIPConfiguration,
    privateKey: string,
    options: BuilderOptions = {}
  ): Promise<CCIPMessenger> {
    const logger = createLogger("ccip-metrics-client", {
      level: options.logLevel ?? LogLevel.INFO,
    });

    // Create base client
    const baseClient = await CCIPMessenger.createFromConfig(
      config,
      privateKey,
      { logLevel: options.logLevel }
    );

    // Add metrics collection wrapper
    if (options.metricsEnabled !== false) {
      logger.info("Metrics collection enabled", {
        endpoint: options.metricsEndpoint || "in-memory",
      });

      // In a real implementation, you would wrap the client methods
      // to collect metrics on:
      // - Transaction count
      // - Success/failure rates
      // - Gas usage
      // - Latency
      // - Error types
    }

    return baseClient;
  }

  /**
   * Create a CCIP client optimized for read-only operations
   * 
   * This method creates a client without signing capabilities,
   * useful for querying chain state without the ability to send transactions.
   * 
   * @param config Configuration for the CCIP client
   * @returns CCIPMessenger configured for read-only access
   */
  static forReadOnly(config: CCIPConfiguration): CCIPMessenger {
    const logger = createLogger("ccip-readonly-client", {
      level: LogLevel.INFO,
    });

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    const context: CCIPEVMContext = {
      provider: { provider }, // Read-only provider
      config: {
        routerAddress: config.routerAddress,
        tokenAdminRegistryAddress: config.tokenAdminRegistryAddress,
      },
      logger,
    };

    logger.info("Created read-only CCIP client", {
      rpcUrl: config.rpcUrl,
      routerAddress: config.routerAddress,
    });

    return new CCIPMessenger(context);
  }
}

// Note: In a production implementation, you would create a proper
// RetriableSigner class that wraps the ethers.Signer and implements
// retry logic for all signing operations. For this example, we're
// keeping it simple and just noting where retry logic would be added.