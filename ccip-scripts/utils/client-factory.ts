import { CCIPClient, CCIPClientOptions, CCIPContext, LogLevel, createLogger } from "../../ccip-sdk";
import { getCCIPConfig } from "../config";
import { createProviderFromPath } from "./provider";
import { CommonOptions, getKeypairPath } from "./config-parser";

/**
 * Options for creating a CCIPClient
 */
export interface CCIPClientFactoryOptions extends CCIPClientOptions, CommonOptions {}

/**
 * Creates a configured CCIPClient instance
 * 
 * @param options Client creation options
 * @returns CCIPClient instance
 */
export function createCCIPClient(options: CCIPClientFactoryOptions = {}): CCIPClient {
  const network = options.network || "devnet";
  const config = getCCIPConfig(network);
  const keypairPath = getKeypairPath(options);
  
  // Create provider from keypair path
  const provider = createProviderFromPath(keypairPath, config.connection);
  
  // Build context with config and provider
  const context: CCIPContext = {
    config,
    provider,
    logger: options.logLevel !== undefined 
      ? createLogger("ccip-client", { level: options.logLevel })
      : undefined
  };
  
  // Return configured CCIPClient
  return new CCIPClient(context);
} 