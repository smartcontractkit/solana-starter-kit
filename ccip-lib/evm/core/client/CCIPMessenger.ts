import { ethers } from "ethers";
import {
  CCIPEVMContext,
  FeeRequest,
  FeeResult,
  TokenAmount,
  SolanaExtraArgsOptions,
  Logger,
  CCIPEVMWriteProvider,
  CCIPMessageRequest,
  CCIPMessageResult,
} from "../models";
import { createLogger, LogLevel } from "../../utils/logger";
import {
  createSolanaExtraArgs,
  encodeSolanaAddressToBytes32,
} from "../../utils/solana";
import { extractCCIPMessageFromReceipt } from "../../utils/ccip";

import {
  RouterClient,
  TokenAdminRegistryClient,
  TokenPoolClient,
  ERC20Client,
} from "../contracts";
import { OnRamp__factory } from "../../types/contracts/factories/OnRamp__factory";
import { Client } from "../../types/contracts/Router";

// Types for enhanced static factory methods
interface CCIPClientOptions {
  logLevel?: LogLevel;
}

interface CCIPEVMConfiguration {
  name: string;
  rpcUrl: string;
  routerAddress: string;
  tokenAdminRegistryAddress: string;
  confirmations: number;
}

interface CCIPConfigurationSource {
  id: string;
  routerAddress: string;
  tokenAdminRegistryAddress: string;
  rpcUrl: string;
  confirmations?: number;
  name: string;
}

/**
 * Client for sending cross-chain messages via CCIP on EVM chains
 * Uses specialized contract clients internally
 */
export class CCIPMessenger {
  private readonly context: CCIPEVMContext;
  private readonly _logger: Logger;

  // Specialized contract clients
  private readonly routerClient: RouterClient;

  /**
   * Creates a new CCIP Messenger client
   *
   * @param context Client context with provider, config, and logger
   */
  constructor(context: CCIPEVMContext) {
    // Initialize context with default logger if not provided
    this.context = {
      provider: context.provider,
      config: context.config,
      logger:
        context.logger ??
        createLogger("ccip-messenger", { level: LogLevel.INFO }),
    };

    // Ensure logger is always available
    this._logger =
      this.context.logger ??
      createLogger("ccip-messenger", { level: LogLevel.INFO });

    // Initialize router client - always required
    this.routerClient = new RouterClient(this.context);

    // TokenAdminRegistry client is initialized on-demand when needed for token transfers
    this._logger.debug("Initialized CCIPMessenger", {
      routerAddress: this.context.config.routerAddress,
      linkTokenAddress: (this.context.config as any).linkTokenAddress || "Not configured",
      wrappedNativeAddress: (this.context.config as any).wrappedNativeAddress || "Not configured",
      tokenAddress: (this.context.config as any).tokenAddress || "Not configured",
      confirmations: (this.context.config as any).confirmations || "Default"
    });
  }

  /**
   * Enhanced static factory method for creating CCIPMessenger from configuration
   * Replaces the need for client-factory.ts pattern
   * 
   * @param config Network configuration object
   * @param privateKey Private key for signing transactions
   * @param options Optional client configuration
   * @returns Promise resolving to CCIPMessenger instance
   */
  static async createFromConfig(
    config: CCIPConfigurationSource,
    privateKey: string,
    options?: CCIPClientOptions
  ): Promise<CCIPMessenger> {
    // Validate configuration
    CCIPMessenger.validateConfiguration(config, privateKey);

    try {
      // Create logger
      const logger = createLogger("ccip-messenger", {
        level: options?.logLevel ?? LogLevel.INFO,
      });

      logger.info(`Creating client for chain: ${config.name} (${config.id})`);

      // Create provider with enhanced error handling
      const provider = CCIPMessenger.createProvider(privateKey, config.rpcUrl);

      // Create context
      const context: CCIPEVMContext = {
        provider,
        config: {
          routerAddress: config.routerAddress,
          tokenAdminRegistryAddress: config.tokenAdminRegistryAddress,
        },
        logger,
      };

      // Create client
      return new CCIPMessenger(context);
    } catch (error) {
      const enhancedError = new Error(`Failed to create CCIP client: ${error instanceof Error ? error.message : String(error)}`);
      (enhancedError as any).context = {
        configId: config.id,
        configName: config.name,
        rpcUrl: config.rpcUrl,
        originalError: error
      };
      throw enhancedError;
    }
  }

  /**
   * Validates configuration for client creation
   * @private
   */
  private static validateConfiguration(config: CCIPConfigurationSource, privateKey: string): void {
    if (!privateKey) {
      throw new Error("Private key is required. Set EVM_PRIVATE_KEY in .env file.");
    }

    if (!config.rpcUrl) {
      throw new Error("RPC URL is required in configuration");
    }

    if (!config.routerAddress) {
      throw new Error("Router address is required in configuration");
    }

    if (!config.tokenAdminRegistryAddress) {
      throw new Error("Token admin registry address is required in configuration");
    }
  }

  /**
   * Creates a provider for EVM operations with enhanced error handling
   * @private
   */
  private static createProvider(privateKey: string, rpcUrl: string): CCIPEVMWriteProvider {
    if (!privateKey) {
      throw new Error("Private key is required");
    }

    if (!rpcUrl) {
      throw new Error("RPC URL is required");
    }

    try {
      // Create provider and signer
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signer = new ethers.Wallet(privateKey, provider);

      // Return provider interface
      return {
        provider,
        signer,
        getAddress: async (): Promise<string> => {
          return signer.address;
        },
      };
    } catch (error) {
      throw new Error(`Failed to create provider: ${error instanceof Error ? error.message : String(error)}`);
    }
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
   * Checks if a destination chain is supported by the router
   * (Read-only operation, works with either provider type)
   *
   * @param chainSelector Destination chain selector
   * @returns True if the chain is supported
   */
  async isChainSupported(chainSelector: bigint): Promise<boolean> {
    return this.routerClient.isChainSupported(chainSelector);
  }

  /**
   * Calculates the fee for a CCIP message
   * (Read-only operation, works with either provider type)
   *
   * @param request Fee calculation request
   * @returns Fee result with token and amount
   */
  async getFee(request: FeeRequest): Promise<FeeResult> {
    this._logger.debug("Calculating CCIP fee", request);

    try {
      // Prepare the router message format - handle type conversion as needed
      const routerMessage: Client.EVM2AnyMessageStruct = {
        receiver: request.message.receiver,
        data: request.message.data || "0x",
        tokenAmounts: request.message.tokenAmounts || [],
        feeToken: request.message.feeToken,
        extraArgs: request.message.extraArgs,
      };

      // Call the router to get the fee
      const fee = await this.routerClient.getFee(
        request.destinationChainSelector,
        routerMessage
      );

      this._logger.debug(`Fee calculation successful: ${fee.toString()}`);

      return {
        token: request.message.feeToken,
        amount: fee,
      };
    } catch (error) {
      this._logger.error(`Error calculating fee: ${error}`);
      throw error;
    }
  }

  /**
   * Sends a CCIP message (data, tokens, or both) across chains
   * (Write operation, requires a provider with signing capabilities)
   *
   * @param request Message request with content
   * @returns Result with transaction hash and message ID
   */
  async sendCCIPMessage(
    request: CCIPMessageRequest
  ): Promise<CCIPMessageResult> {
    this._logger.debug("Preparing CCIP message", request);

    // Verify chain is supported
    const isSupported = await this.isChainSupported(
      request.destinationChainSelector
    );
    if (!isSupported) {
      const error = `Destination chain ${request.destinationChainSelector} is not supported`;
      this._logger.error(error);
      throw new Error(error);
    }

    // Create the CCIP message
    const message = {
      receiver: request.receiver,
      data: request.data || "0x",
      tokenAmounts: request.tokenAmounts || [],
      feeToken: request.feeToken,
      extraArgs: request.extraArgs,
    };

    // Calculate fee
    const feeRequest: FeeRequest = {
      destinationChainSelector: request.destinationChainSelector,
      message: {
        receiver: message.receiver,
        data: message.data,
        tokenAmounts: message.tokenAmounts,
        feeToken: message.feeToken,
        extraArgs: message.extraArgs,
      },
    };

    const feeResult = await this.getFee(feeRequest);
    this._logger.info(`Estimated fee: ${feeResult.amount.toString()}`);

    // Only validate and approve tokens if they are included in the message
    if (message.tokenAmounts.length > 0) {
      try {
        // Get the TokenAdminRegistry client for validating tokens
        const tokenAdminRegistryClient = await this.getTokenAdminRegistryClient(
          request.destinationChainSelector
        );

        // Validate tokens with the TokenAdminRegistry
        await this.validateTokenTransfers(
          tokenAdminRegistryClient,
          request.tokenAmounts,
          request.destinationChainSelector
        );
      } catch (error) {
        // Critical infrastructure error - token transfers cannot be validated
        this._logger.error(`Cannot validate token transfers: ${error}`);
        throw new Error(
          `Token transfers cannot be validated. Please check that the destination chain and tokens are properly configured. Error: ${error.message}`
        );
      }
    }

    // Approve tokens for transfer, including the fee token with the actual fee amount
    await this.approveTokensIfNeeded(request.tokenAmounts, feeResult);

    try {
      // Prepare transaction options
      const txOptions: { value?: bigint } = {};

      // If using native ETH for fees, include the fee in the transaction value
      if (request.feeToken === ethers.ZeroAddress) {
        txOptions.value = feeResult.amount;
        this._logger.debug(`Setting transaction value to ${txOptions.value}`);
      }

      // Send the CCIP message using the router client
      this._logger.info("Sending CCIP message...");
      const receipt = await this.routerClient.ccipSend(
        request.destinationChainSelector,
        message,
        txOptions
      );

      this._logger.info(`Transaction sent: ${receipt.hash}`);

      // Extract message ID from receipt
      const ccipMessage = extractCCIPMessageFromReceipt(receipt);

      if (ccipMessage) {
        this._logger.info(`Message ID: ${ccipMessage.header.messageId}`);
        return {
          transactionHash: receipt.hash,
          messageId: ccipMessage.header.messageId,
          blockNumber: receipt.blockNumber,
          destinationChainSelector:
            ccipMessage.header.destChainSelector.toString(),
          sequenceNumber: ccipMessage.header.sequenceNumber.toString(),
        };
      } else {
        this._logger.warn(
          "Could not extract message ID from transaction receipt"
        );
        return {
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        };
      }
    } catch (error) {
      this._logger.error(`Error sending CCIP message: ${error}`);
      throw error;
    }
  }

  /**
   * Gets or initializes a TokenAdminRegistry client
   *
   * @param destinationChainSelector The destination chain selector
   * @returns TokenAdminRegistry client
   * @throws Error if OnRamp or TokenAdminRegistry is not available
   */
  private async getTokenAdminRegistryClient(
    destinationChainSelector: bigint
  ): Promise<TokenAdminRegistryClient> {
    this._logger.debug("Fetching TokenAdminRegistry address from chain");

    try {
      // Get the OnRamp address for the destination chain from the router
      const routerContract = this.routerClient.getReadContract();
      const onRampAddress = await routerContract.getOnRamp(
        destinationChainSelector
      );

      if (onRampAddress === ethers.ZeroAddress) {
        const error = `Critical error: No OnRamp found for destination chain ${destinationChainSelector}`;
        this._logger.error(error);
        throw new Error(error);
      }

      this._logger.debug(
        `Found OnRamp at ${onRampAddress} for chain ${destinationChainSelector}`
      );

      // Get the TokenAdminRegistry address from the OnRamp's static config
      const onRamp = OnRamp__factory.connect(
        onRampAddress,
        this.context.provider.provider
      );

      const staticConfig = await onRamp.getStaticConfig();
      const tokenAdminRegistryAddress = staticConfig.tokenAdminRegistry;

      if (tokenAdminRegistryAddress === ethers.ZeroAddress) {
        const error =
          "Critical error: TokenAdminRegistry address is zero address";
        this._logger.error(error);
        throw new Error(error);
      }

      this._logger.debug(
        `Found TokenAdminRegistry at ${tokenAdminRegistryAddress}`
      );

      // Update context config with the fetched address
      this.context.config.tokenAdminRegistryAddress = tokenAdminRegistryAddress;

      // Initialize and return TokenAdminRegistry client
      return new TokenAdminRegistryClient(this.context);
    } catch (error) {
      this._logger.error(`Error fetching TokenAdminRegistry: ${error}`);
      throw error;
    }
  }

  /**
   * Validates that tokens are supported for the destination chain
   * (Read-only operation but internally called by write operations)
   *
   * @param tokenAdminRegistryClient The TokenAdminRegistry client
   * @param tokenAmounts Token amounts to validate
   * @param destinationChainSelector Chain selector for the destination
   */
  private async validateTokenTransfers(
    tokenAdminRegistryClient: TokenAdminRegistryClient,
    tokenAmounts: TokenAmount[],
    destinationChainSelector: bigint
  ): Promise<void> {
    this._logger.debug("Validating token transfers for destination chain");

    for (const { token } of tokenAmounts) {
      // Get the token pool from the TokenAdminRegistry
      const poolAddress = await tokenAdminRegistryClient.getPool(token);

      if (poolAddress === ethers.ZeroAddress) {
        throw new Error(
          `Token ${token} is not supported (no pool found in TokenAdminRegistry)`
        );
      }

      // Create TokenPool client for this specific pool and check support
      const tokenPoolClient = new TokenPoolClient(this.context, poolAddress);
      const isChainSupported = await tokenPoolClient.isSupportedChain(
        destinationChainSelector
      );

      if (!isChainSupported) {
        throw new Error(
          `Destination chain ${destinationChainSelector} is not supported for token ${token} (pool address: ${poolAddress})`
        );
      }

      this._logger.debug(
        `Token ${token} is supported for destination chain ${destinationChainSelector} with pool ${poolAddress}`
      );
    }
  }

  /**
   * Approves tokens for spending by the router if needed
   * (Write operation, requires a provider with signing capabilities)
   *
   * @param tokenAmounts Token amounts to approve
   * @param feeResult Fee result containing token and amount
   */
  private async approveTokensIfNeeded(
    tokenAmounts: TokenAmount[],
    feeResult: FeeResult
  ): Promise<void> {
    // Ensure we have signing capabilities
    if (!("signer" in this.context.provider)) {
      throw new Error(
        "Token approval requires signing capabilities. Initialize the client with a signer."
      );
    }

    this._logger.debug("Checking token approvals");

    // Get signer address
    const signerAddress = await (
      this.context.provider as CCIPEVMWriteProvider
    ).getAddress();

    // Create a map to track tokens and their required approval amounts
    const tokenApprovalsMap = new Map<string, { amount: bigint, isFeeToken: boolean }>();

    // Add all transfer tokens to the approvals map
    for (const { token, amount } of tokenAmounts) {
      const normalizedToken = token.toLowerCase();
      // Check if this token is also being used as the fee token
      const isFeeToken = this.isFeeToken(token, feeResult.token);
      
      tokenApprovalsMap.set(normalizedToken, { amount, isFeeToken });
      this._logger.debug(`Added ${isFeeToken ? "fee" : "transfer"} token to approvals: ${token}, amount: ${amount.toString()}`);
    }

    // Handle fee token based on the three scenarios
    if (feeResult.token !== ethers.ZeroAddress) {
      // Non-native token fee (ERC20 token)
      const normalizedFeeToken = feeResult.token.toLowerCase();
      
      this._logger.debug(`Processing fee token: ${feeResult.token}`);

      if (!tokenApprovalsMap.has(normalizedFeeToken)) {
        // Case: Fee token is not in the transfer tokens list
        tokenApprovalsMap.set(normalizedFeeToken, { amount: feeResult.amount, isFeeToken: true });
        this._logger.debug(
          `Adding fee token ${feeResult.token} to approvals map with amount ${feeResult.amount}`
        );
      } else {
        // Case: Fee token is already in transfers
        const existingEntry = tokenApprovalsMap.get(normalizedFeeToken);
        const totalAmount = existingEntry.amount + feeResult.amount;

        tokenApprovalsMap.set(normalizedFeeToken, { amount: totalAmount, isFeeToken: true });
        this._logger.debug(
          `Setting approval for ${feeResult.token} to ${totalAmount} ` +
          `(transfer amount ${existingEntry.amount} + fee amount ${feeResult.amount})`
        );
      }
    } else {
      // Case: Native ETH for fees - no approval needed
      this._logger.debug(
        "Using native ETH for fees, no additional approval needed"
      );
    }

    // Process all approvals from the map - first fee tokens, then transfer tokens
    this._logger.debug(`Processing approvals for ${tokenApprovalsMap.size} tokens`);
    
    // First pass: Process fee tokens with priority
    for (const [token, { amount, isFeeToken }] of tokenApprovalsMap.entries()) {
      if (isFeeToken) {
        await this.approveTokenIfNeeded(token, amount, signerAddress, true);
      }
    }
    
    // Second pass: Process remaining tokens
    for (const [token, { amount, isFeeToken }] of tokenApprovalsMap.entries()) {
      if (!isFeeToken) {
        await this.approveTokenIfNeeded(token, amount, signerAddress, false);
      }
    }
  }

  /**
   * Determines if a token is the fee token for the current transfer
   * 
   * @param tokenAddress The token address to check
   * @param currentFeeToken The fee token being used for the current transfer
   * @returns True if this token is being used as the fee token
   */
  private isFeeToken(tokenAddress: string, currentFeeToken: string): boolean {
    // No token or Zero address is never a fee token
    if (!tokenAddress || tokenAddress === ethers.ZeroAddress) return false;
    
    // Native ETH (Zero address) is handled separately in the CCIP flow
    if (currentFeeToken === ethers.ZeroAddress) return false;
    
    // Simple direct comparison with normalized addresses
    return tokenAddress.toLowerCase() === currentFeeToken.toLowerCase();
  }

  /**
   * Checks if a token needs approval and approves it if needed
   * (Write operation, requires a provider with signing capabilities)
   *
   * @param tokenAddress Token address
   * @param amount Amount to approve
   * @param ownerAddress Owner address
   * @param isFeeToken Whether this token is being used as a fee token
   */
  private async approveTokenIfNeeded(
    tokenAddress: string,
    amount: bigint,
    ownerAddress: string,
    isFeeToken: boolean
  ): Promise<void> {
    // Create ERC20 client for this specific token
    const erc20Client = new ERC20Client(this.context, tokenAddress);

    try {
      // Get token details for logging
      const symbol = await erc20Client.getSymbol();
      const formattedAmount = await erc20Client.formatAmount(amount);
      
      // Add a buffer to fee token allowances to account for potential fee changes between approval and execution
      let approvalAmount = amount;
      if (isFeeToken) {
        // Add 20% buffer for fee tokens
        approvalAmount = amount + (amount * BigInt(20) / BigInt(100));
        this._logger.debug(
          `Adding 20% buffer to fee token approval: ${amount} → ${approvalAmount}`
        );
      }

      // Check current allowance
      const allowance = await erc20Client.getAllowance(
        ownerAddress,
        this.config.routerAddress
      );
      
      const formattedAllowance = await erc20Client.formatAmount(allowance);
      
      // Debug log with technical details
      this._logger.debug(
        `Token allowance check: ${symbol} (${tokenAddress})`, 
        {
          required: approvalAmount.toString(),
          current: allowance.toString(),
          sufficient: allowance >= approvalAmount,
          role: isFeeToken ? "fee token" : "transfer token",
          isFeeToken: isFeeToken // Explicitly include the boolean value
        }
      );

      if (allowance < approvalAmount) {
        const formattedApprovalAmount = await erc20Client.formatAmount(approvalAmount);
        
        this._logger.info(
          `Approving ${formattedApprovalAmount} ${symbol} for CCIP Router`
        );
        
        if (isFeeToken) {
          this._logger.info(
            `This token is being used as the fee token with a 20% buffer included`
          );
        }

        // Send approval transaction
        const txReceipt = await erc20Client.approve(this.config.routerAddress, approvalAmount);
        
        this._logger.info(`${symbol} approved for CCIP Router`);
        
        // Verify allowance after approval with retry mechanism
        await this.verifyAllowanceAfterApproval(
          erc20Client,
          ownerAddress,
          this.config.routerAddress,
          approvalAmount,
          symbol
        );
      } else {
        // Enhanced logging for the existing allowance case
        const surplus = allowance - approvalAmount;
        const formattedSurplus = await erc20Client.formatAmount(surplus);
        const formattedApprovalAmount = await erc20Client.formatAmount(approvalAmount);
        
        this._logger.info(
          `${symbol} already has sufficient allowance: ${formattedAllowance} (needed: ${formattedApprovalAmount}, surplus: ${formattedSurplus})`
        );
        
        if (isFeeToken) {
          this._logger.info(
            `Using existing allowance for fee token`
          );
        }
      }
    } catch (error) {
      this._logger.error(`Error approving token: ${error}`);
      throw error;
    }
  }

  /**
   * Verifies that an allowance has been properly recorded on-chain after approval
   * 
   * @param erc20Client ERC20 client for the token
   * @param ownerAddress Owner address
   * @param spenderAddress Spender address (router)
   * @param requiredAmount Required allowance amount
   * @param symbol Token symbol for logging
   * @param retries Number of verification attempts remaining
   * @param delayMs Delay between verification attempts in milliseconds
   */
  private async verifyAllowanceAfterApproval(
    erc20Client: ERC20Client,
    ownerAddress: string,
    spenderAddress: string,
    requiredAmount: bigint,
    symbol: string,
    retries = 3,
    delayMs = 2000
  ): Promise<void> {
    this._logger.debug(`Verifying on-chain allowance for ${symbol}...`);
    
    // Wait for the transaction to be confirmed and allowance updated
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    try {
      // Check the on-chain allowance
      const currentAllowance = await erc20Client.getAllowance(
        ownerAddress,
        spenderAddress
      );
      
      const formattedAllowance = await erc20Client.formatAmount(currentAllowance);
      const formattedRequired = await erc20Client.formatAmount(requiredAmount);
      
      // Log the verification result
      this._logger.debug(`On-chain allowance verification for ${symbol}`, {
        required: requiredAmount.toString(),
        actual: currentAllowance.toString(),
        sufficient: currentAllowance >= requiredAmount,
        verificationAttempt: 4 - retries
      });
      
      if (currentAllowance < requiredAmount) {
        // Allowance is still insufficient
        if (retries > 0) {
          this._logger.warn(
            `Allowance verification failed for ${symbol}: ` +
            `required ${formattedRequired} but found ${formattedAllowance}. ` +
            `Retrying in ${delayMs/1000}s... (${retries} attempts left)`
          );
          
          // Exponential backoff
          const nextDelayMs = delayMs * 1.5;
          
          // Retry with backoff
          return this.verifyAllowanceAfterApproval(
            erc20Client,
            ownerAddress,
            spenderAddress,
            requiredAmount,
            symbol,
            retries - 1,
            Math.min(nextDelayMs, 10000) // Cap at 10 seconds max
          );
        } else {
          // Out of retries, log error but continue
          this._logger.error(
            `Failed to verify allowance for ${symbol} after multiple attempts: ` +
            `required ${formattedRequired} but found ${formattedAllowance}. ` +
            `Transaction might fail due to insufficient allowance.`
          );
        }
      } else {
        // Allowance verified successfully
        this._logger.info(
          `✅ Verified on-chain allowance for ${symbol}: ${formattedAllowance} ` +
          `(required: ${formattedRequired})`
        );
      }
    } catch (error) {
      this._logger.error(`Error verifying allowance for ${symbol}: ${error}`);
      if (retries > 0) {
        // Retry on error
        return this.verifyAllowanceAfterApproval(
          erc20Client,
          ownerAddress,
          spenderAddress,
          requiredAmount,
          symbol,
          retries - 1,
          delayMs * 2
        );
      }
    }
  }

  /**
   * Creates Solana-specific extra arguments
   * (Utility method, works with any provider type)
   *
   * @param options Extra arguments options
   * @returns Encoded extra arguments
   */
  createSolanaExtraArgs(options: SolanaExtraArgsOptions = {}): string {
    return createSolanaExtraArgs(options, this._logger);
  }

  /**
   * Encodes a Solana address to bytes32 format
   * (Utility method, works with any provider type)
   *
   * @param solanaAddress Solana address
   * @returns Bytes32 encoded address
   */
  encodeSolanaAddress(solanaAddress: string): string {
    return encodeSolanaAddressToBytes32(solanaAddress);
  }
}
