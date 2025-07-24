import { ethers } from "ethers";
import {
  createLogger,
  LogLevel,
  CCIPMessenger,
  CCIPEVMWriteProvider,
  CCIPTokenValidator,
  TokenDetails,
  TokenAmountSpec,
} from "../../../ccip-lib/evm";
import { CCIPScriptOptions } from "./message-utils";
import { getEVMConfig, EVMChainConfig } from "../../config";
import { checkAndWarnBalance } from "./wallet-utils";

// Re-export TokenDetails from SDK
export type { TokenDetails } from "../../../ccip-lib/evm";

/**
 * Client context with all necessary components
 */
export interface ClientContext {
  client: CCIPMessenger;
  logger: ReturnType<typeof createLogger>;
  config: EVMChainConfig;
  signerAddress: string;
  options: CCIPScriptOptions;
}

/**
 * Type guard to check if provider has write capabilities
 */
function isWriteProvider(provider: any): provider is CCIPEVMWriteProvider {
  return provider && typeof provider.getAddress === "function";
}

/**
 * Setup the CCIP client and context for script execution
 *
 * This is a high-level wrapper around CCIPMessenger.createFromConfig()
 * that adds script-friendly features like balance checking and logging.
 *
 * **When to use this function:**
 * - Writing executable scripts that need user feedback
 * - Need automatic wallet balance validation
 * - Want consistent logging setup across scripts
 * - Require full context including signer address and config
 *
 * **When to use CCIPMessenger.createFromConfig() directly:**
 * - Building libraries or SDK extensions
 * - Need minimal overhead without console output
 * - Want custom context handling
 * - Building middleware or service layers
 *
 * @example
 * ```typescript
 * // For scripts - use setupClientContext
 * const context = await setupClientContext(options, "token-transfer");
 * context.logger.info(`Sending from: ${context.signerAddress}`);
 *
 * // For libraries - use createFromConfig directly
 * const client = await CCIPMessenger.createFromConfig(config, privateKey);
 * ```
 *
 * @param options Script options including privateKey, chainId, and logLevel
 * @param scriptName Name of the script for logging purposes
 * @returns Complete client context with client, logger, config, and signer address
 * @throws Error if provider doesn't have signing capabilities or configuration is invalid
 */
export async function setupClientContext(
  options: CCIPScriptOptions,
  scriptName: string
): Promise<ClientContext> {
  // Create logger
  const logger = createLogger(scriptName, {
    level: options.logLevel ?? LogLevel.INFO,
  });

  // Display environment info
  logger.info("\n==== Environment Information ====");

  // Use provided chainId
  const chainId = options.chainId;
  const config = getEVMConfig(chainId);

  logger.info(`Router Address: ${config.routerAddress}`);

  // Create CCIP client using enhanced static method
  const client = await CCIPMessenger.createFromConfig(
    config,
    options.privateKey!,
    { logLevel: options.logLevel }
  );

  // Get signer address from provider
  let signerAddress: string;

  // Use a proper type guard to check if the provider has signing capabilities
  if (isWriteProvider(client.provider)) {
    signerAddress = await client.provider.getAddress();
    logger.info(`Wallet Address: ${signerAddress}`);

    // Check wallet balance using utility function
    const provider = client.provider.provider;
    await checkAndWarnBalance(provider, signerAddress, logger);
  } else {
    throw new Error(
      "Write provider with signing capabilities is required for this operation"
    );
  }

  // Return the complete context
  return {
    client,
    logger,
    config,
    signerAddress,
    options,
  };
}

/**
 * Get token details and balances for multiple tokens
 * @param context Client context
 * @param tokenAmounts Array of token addresses and amounts
 * @returns Array of token details
 */
export async function getTokenDetails(
  context: ClientContext,
  tokenAmounts: Array<{ token: string; amount: string }>
): Promise<TokenDetails[]> {
  const { client, signerAddress } = context;

  if (tokenAmounts.length === 0) {
    throw new Error(
      "No token amounts provided. Please specify at least one token to transfer."
    );
  }

  // Extract token addresses
  const tokenAddresses = tokenAmounts.map(ta => ta.token);

  // Use SDK validation utility
  const ccipContext = {
    provider: client.provider,
    config: client.config,
    logger: context.logger,
  };

  return CCIPTokenValidator.getTokenDetails(ccipContext, signerAddress, tokenAddresses);
}

/**
 * Validate that there's enough token balance for all transfers
 * @param context Client context
 * @param tokenDetailsList List of token details (optional, will be fetched if not provided)
 * @returns Map of token addresses to validated amounts
 */
export async function validateTokenAmounts(
  context: ClientContext,
  tokenDetailsList?: TokenDetails[]
): Promise<Map<string, bigint>> {
  const { client, logger, options, signerAddress } = context;

  if (!options.tokenAmounts || options.tokenAmounts.length === 0) {
    throw new Error("No token amounts provided for validation");
  }

  // Use SDK validation utility
  const ccipContext = {
    provider: client.provider,
    config: client.config,
    logger: logger,
  };

  const validationResult = await CCIPTokenValidator.validateTokenAmounts(
    ccipContext,
    signerAddress,
    options.tokenAmounts
  );

  return validationResult.validatedAmounts;
}
