import { CCIPMessenger, createLogger, LogLevel } from "../../../ccip-lib/evm";
import { ChainId, getEVMConfig } from "../../config";
import { createProvider } from "./provider";
import { CommonOptions } from "./config-parser";

/**
 * Options for creating a CCIPMessenger
 */
export interface ClientFactoryOptions extends CommonOptions {
  // Add chainId parameter
  chainId: ChainId;
}

/**
 * Creates a configured CCIPMessenger client
 *
 * @param options Client creation options
 * @returns CCIPMessenger instance
 */
export function createCCIPClient(options: ClientFactoryOptions): CCIPMessenger {
  // Validate private key
  if (!options.privateKey) {
    throw new Error(
      "Private key is required. Set EVM_PRIVATE_KEY in .env file."
    );
  }

  try {
    // Get network config - use provided chainId or default to Ethereum Sepolia
    const chainId = options.chainId;
    const config = getEVMConfig(chainId);

    // Create logger
    const logger = createLogger("ccip-messenger", {
      level: options.logLevel ?? LogLevel.INFO,
    });

    logger.info(`Creating client for chain: ${config.name} (${chainId})`);

    // Create provider
    const provider = createProvider(options.privateKey, config.rpcUrl);

    // Create context
    const context = {
      provider,
      config: {
        routerAddress: config.routerAddress,
        tokenAdminRegistryAddress: config.tokenAdminRegistryAddress,
      },
      logger,
      confirmations: config.confirmations,
    };

    // Create client
    return new CCIPMessenger(context);
  } catch (error) {
    console.error("Failed to create CCIP client:", error);
    throw error;
  }
}
