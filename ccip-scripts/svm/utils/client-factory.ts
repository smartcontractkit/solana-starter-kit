import {
  CCIPClient,
  CCIPClientOptions,
  CCIPContext,
  LogLevel,
  createLogger,
} from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig, adaptSVMConfigForLibrary } from "../../config";
import { createProviderFromPath } from "./provider";
import { CommonOptions, getKeypairPath } from "./config-parser";

/**
 * Options for creating a CCIPClient
 */
export interface CCIPClientFactoryOptions
  extends CCIPClientOptions,
    CommonOptions {}

/**
 * Creates a configured CCIPClient instance
 *
 * @param options Client creation options
 * @returns CCIPClient instance
 */
export function createCCIPClient(
  options: CCIPClientFactoryOptions = {}
): CCIPClient {
  // We only support SOLANA_DEVNET for now
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  const keypairPath = getKeypairPath(options);

  // Create provider from keypair path
  const provider = createProviderFromPath(keypairPath, config.connection);

  // Build context with config and provider
  const context: CCIPContext = {
    // Use the adapter function to convert our config to the format expected by the library
    config: adaptSVMConfigForLibrary(config),
    provider,
    logger:
      options.logLevel !== undefined
        ? createLogger("ccip-client", { level: options.logLevel })
        : undefined,
  };

  // Return configured CCIPClient
  return new CCIPClient(context);
}
