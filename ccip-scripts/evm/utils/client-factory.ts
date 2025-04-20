import { CCIPMessenger, createLogger, LogLevel } from "../../../ccip-lib/evm";
import { ChainId, getEVMConfig } from "../../config";
import { createProvider } from "./provider";
import { CommonOptions } from "./config-parser";

/**
 * Options for creating a CCIPMessenger
 */
export interface ClientFactoryOptions extends CommonOptions {}

/**
 * Creates a configured CCIPMessenger client
 * 
 * @param options Client creation options
 * @returns CCIPMessenger instance
 */
export function createCCIPClient(options: ClientFactoryOptions): CCIPMessenger {
  // Validate private key
  if (!options.privateKey) {
    throw new Error("Private key is required. Set EVM_PRIVATE_KEY in .env file.");
  }
  
  // Get network config - hardcoded to Ethereum Sepolia
  const config = getEVMConfig(ChainId.ETHEREUM_SEPOLIA);
  
  // Create provider
  const provider = createProvider(options.privateKey, config.rpcUrl);
  
  // Create logger
  const logger = createLogger("ccip-messenger", { 
    level: options.logLevel ?? LogLevel.INFO 
  });
  
  // Create context
  const context = {
    provider,
    config: {
      routerAddress: config.routerAddress,
      tokenAdminRegistryAddress: config.tokenAdminRegistryAddress
    },
    logger,
    confirmations: config.confirmations
  };
  
  // Create client
  return new CCIPMessenger(context);
} 