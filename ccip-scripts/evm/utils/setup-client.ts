import { ethers } from "ethers";
import {
  createLogger,
  LogLevel,
  CCIPMessenger,
  ERC20Client,
  CCIPEVMWriteProvider,
} from "../../../ccip-lib/evm";
import { CCIPScriptOptions } from "./message-utils";
import { ChainId, getEVMConfig, EVMChainConfig } from "../../config";
import { checkAndWarnBalance } from "./wallet-utils";

/**
 * Token details with balance information
 */
export interface TokenDetails {
  tokenClient: ERC20Client;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenBalance: bigint;
}

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
  const { client, logger, signerAddress } = context;

  if (tokenAmounts.length === 0) {
    throw new Error(
      "No token amounts provided. Please specify at least one token to transfer."
    );
  }

  const results: TokenDetails[] = [];

  for (const { token: tokenAddress } of tokenAmounts) {
    // Create a proper ERC20 client for the token
    const tokenClient = new ERC20Client(
      {
        provider: client.provider,
        config: client.config,
        logger: logger,
      },
      tokenAddress
    );

    // Get token details
    const tokenSymbol = await tokenClient.getSymbol();
    const tokenDecimals = await tokenClient.getDecimals();
    const tokenBalance = await tokenClient.getBalance(signerAddress);

    logger.info(`Token: ${tokenSymbol} (${tokenAddress})`);
    logger.info(
      `Token Balance: ${ethers.formatUnits(
        tokenBalance,
        tokenDecimals
      )} ${tokenSymbol}`
    );

    results.push({
      tokenClient,
      tokenAddress,
      tokenSymbol,
      tokenDecimals,
      tokenBalance,
    });
  }

  return results;
}

/**
 * Validate that there's enough token balance for all transfers
 * @param context Client context
 * @param tokenDetailsList List of token details
 * @returns Map of token addresses to validated amounts
 */
export function validateTokenAmounts(
  context: ClientContext,
  tokenDetailsList: TokenDetails[]
): Map<string, bigint> {
  const { logger, options } = context;

  if (!options.tokenAmounts || options.tokenAmounts.length === 0) {
    throw new Error("No token amounts provided for validation");
  }

  const validatedAmounts = new Map<string, bigint>();

  for (const { token, amount } of options.tokenAmounts) {
    // Find matching token details
    const tokenDetails = tokenDetailsList.find(
      (td) => td.tokenAddress.toLowerCase() === token.toLowerCase()
    );

    if (!tokenDetails) {
      throw new Error(`Token details not found for ${token}`);
    }

    // Parse amount - all amounts are treated as raw values
    let parsedAmount: bigint;
    try {
      parsedAmount = BigInt(amount);
    } catch (error) {
      throw new Error(
        `Invalid amount format for ${tokenDetails.tokenSymbol}: ${amount}. Expected raw token amount (with all decimals).`
      );
    }

    // Check if balance is sufficient
    if (tokenDetails.tokenBalance < parsedAmount) {
      const formattedBalance = ethers.formatUnits(
        tokenDetails.tokenBalance,
        tokenDetails.tokenDecimals
      );
      const formattedAmount = ethers.formatUnits(
        parsedAmount,
        tokenDetails.tokenDecimals
      );

      throw new Error(
        `Insufficient ${tokenDetails.tokenSymbol} balance. Have ${formattedBalance}, need ${formattedAmount}`
      );
    }

    logger.info(
      `Transfer Amount: ${ethers.formatUnits(
        parsedAmount,
        tokenDetails.tokenDecimals
      )} ${tokenDetails.tokenSymbol}`
    );
    validatedAmounts.set(token, parsedAmount);
  }

  return validatedAmounts;
}
