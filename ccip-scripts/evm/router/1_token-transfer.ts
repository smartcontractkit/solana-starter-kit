/**
 * EVM to Solana CCIP Token Transfer (CLI Framework Version)
 *
 * This script demonstrates how to send tokens from Ethereum to Solana
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 * 
 * Professional CLI framework implementation with type safety,
 * argument validation, and consistent help formatting.
 */

import {
  CCIPCommand,
  ArgumentDefinition,
  CommandMetadata,
  BaseCommandOptions,
} from "../utils/cli-framework";
import {
  setupClientContext,
  getTokenDetails,
  validateTokenAmounts,
} from "../utils/setup-client";
import {
  createCCIPMessageRequest,
  displayTransferSummary,
  displayTransferResults,
} from "../utils/message-utils";
import { PublicKey } from "@solana/web3.js";
import { FeeTokenType, getEVMConfig, ChainId } from "../../config";

/**
 * Options specific to the token transfer command
 */
interface TokenTransferOptions extends BaseCommandOptions {
  // Token transfer specific options
  sourceChain?: ChainId;
  defaultReceiver?: string;
  defaultTokenReceiver?: string;
  defaultComputeUnits?: number;
}

/**
 * Token Transfer Command Implementation
 */
class TokenTransferCommand extends CCIPCommand<TokenTransferOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "token-transfer",
      description:
        "🚀 EVM to Solana CCIP Token Transfer\n\nSend tokens from EVM chains (Ethereum, Avalanche) to Solana using Chainlink CCIP. Supports single and multi-token transfers with automatic approval handling.",
      examples: [
        "# Transfer BnM token with default settings",
        "yarn evm:token-transfer",
        "",
        "# Transfer custom token",
        "yarn evm:token-transfer --token 0x779877A7B0D9E8603169DdbD7836e478b4624789 --amount 1000000000000000000",
        "",
        "# Transfer multiple tokens",
        'yarn evm:token-transfer --token-amounts "0x779...789:1000000000000000000,0xFd5...05:2000000000000000000"',
        "",
        "# Use different fee token",
        "yarn evm:token-transfer --fee-token native --log-level DEBUG",
        "",
        "# Custom Solana receiver",
        "yarn evm:token-transfer --token-receiver 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      ],
      notes: [
        "Requires EVM_PRIVATE_KEY in environment variables",
        "Default source chain is Ethereum Sepolia",
        "Supports BnM, LINK, and custom ERC20 tokens",
        "Automatically handles token approvals for CCIP router",
        "Token amounts must include full decimals (e.g., 1000000000000000000 for 1 token with 18 decimals)",
        "For multiple tokens, use format: token1:amount1,token2:amount2",
        "Receiver address is for CCIP message; token-receiver is where tokens arrive",
      ],
    };

    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "source-chain",
        aliases: ["s"],
        type: "string",
        description: "Source chain to send from",
        defaultValue: ChainId.ETHEREUM_SEPOLIA,
        example: "ethereum-sepolia",
      },
      {
        name: "token",
        aliases: ["t"],
        type: "string",
        description: "Token address to transfer (for single token)",
        example: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      },
      {
        name: "amount",
        aliases: ["a"],
        type: "string",
        description: "Amount to transfer in raw units (with decimals)",
        example: "1000000000000000000",
      },
      {
        name: "token-amounts",
        type: "string",
        description: "Multiple tokens in format: token1:amount1,token2:amount2",
        example: "0x779...789:1000000000000000000,0xFd5...05:2000000000000000000",
      },
      {
        name: "token-receiver",
        aliases: ["tr"],
        type: "string",
        description: "Solana wallet address to receive tokens",
        defaultValue: "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB",
        example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      },
      {
        name: "receiver",
        aliases: ["r"],
        type: "string", 
        description: "CCIP message receiver address",
        defaultValue: PublicKey.default.toString(),
        example: PublicKey.default.toString(),
      },
      {
        name: "compute-units",
        aliases: ["cu"],
        type: "number",
        description: "Solana compute units for execution",
        defaultValue: 0,
        example: "200000",
      },
    ];
  }

  /**
   * Get default token configuration based on source chain
   */
  private getDefaultTokenAmounts(): Array<{ token: string; amount: string }> {
    const sourceChainConfig = getEVMConfig(this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA);
    
    return [
      {
        token: sourceChainConfig.bnmTokenAddress,
        amount: "10000000000000000", // 0.01 BnM with 18 decimals
      },
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("🚀 EVM to Solana CCIP Token Transfer");
    this.logger.info("=========================================");

    try {
      // Prepare token transfer configuration
      const sourceChain = this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA;
      const sourceChainConfig = getEVMConfig(sourceChain);

      // Determine token amounts to transfer
      let tokenAmounts: Array<{ token: string; amount: string }>;

      if (this.options.tokenAmounts && this.options.tokenAmounts.length > 0) {
        // Use provided token amounts from CLI
        tokenAmounts = this.options.tokenAmounts;
      } else if (this.options.token && this.options.amount) {
        // Use single token from CLI arguments
        tokenAmounts = [{ token: this.options.token, amount: this.options.amount }];
      } else {
        // Use default BnM token
        tokenAmounts = this.getDefaultTokenAmounts();
        this.logger.info("Using default BnM token transfer");
      }

      this.logger.debug(`Token amounts to transfer:`, tokenAmounts);

      // Prepare transfer options for utility functions
      const transferOptions = {
        // Token configuration
        tokenAmounts,
        
        // Fee configuration
        feeToken: this.options.feeToken || FeeTokenType.LINK,
        
        // Receiver configuration
        receiver: this.options.receiver || PublicKey.default.toString(),
        tokenReceiver: this.options.tokenReceiver || "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB",
        
        // Solana execution configuration
        data: "0x", // Empty data for token transfers
        computeUnits: this.options.computeUnits || 0,
        allowOutOfOrderExecution: true,
        accountIsWritableBitmap: BigInt(0),
        accounts: [],
        
        // Chain configuration
        chainId: sourceChain,
        
        // Logging
        logLevel: this.options.logLevel,
        privateKey: this.options.privateKey,
      };

      this.logger.info(`Source Chain: ${sourceChain}`);
      this.logger.info(`Fee Token: ${transferOptions.feeToken}`);
      this.logger.info(`Token Receiver: ${transferOptions.tokenReceiver}`);
      this.logger.info(`Compute Units: ${transferOptions.computeUnits}`);

      // Set up client context
      const context = await setupClientContext(transferOptions, "token-transfer");
      
      // Update logger to use the properly configured one from context
      this.logger = context.logger;

      const { client, config, signerAddress } = context;

      this.logger.info("\n🔍 Validating Token Transfer");
      this.logger.info("=========================================");

      // Get token details and validate balances
      const tokenDetails = await getTokenDetails(context, tokenAmounts);
      const validatedAmounts = validateTokenAmounts(context, tokenDetails);

      this.logger.info("✅ Token validation successful");

      // Create CCIP message request
      const messageRequest = createCCIPMessageRequest(config, transferOptions, this.logger);

      this.logger.info("\n📋 Transfer Summary");
      this.logger.info("=========================================");

      // Display transfer summary (using first token for display)
      const primaryToken = tokenDetails[0];
      displayTransferSummary(
        config,
        transferOptions,
        messageRequest,
        {
          symbol: primaryToken.tokenSymbol,
          decimals: primaryToken.tokenDecimals,
        },
        this.logger,
        signerAddress
      );

      this.logger.info("\n🚀 Executing Token Transfer");
      this.logger.info("=========================================");
      this.logger.info("Sending CCIP message...");

      // Execute the transfer
      const result = await client.sendCCIPMessage(messageRequest);

      this.logger.info("\n🎉 Transfer Results");
      this.logger.info("=========================================");

      // Display results
      displayTransferResults(result, config, this.logger);

      this.logger.info("\n✅ Token Transfer Complete!");
      this.logger.info("🔗 Your tokens are being bridged to Solana");

    } catch (error) {
      this.logger.error(
        `❌ Token transfer failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command when executed directly
if (require.main === module) {
  const command = new TokenTransferCommand();
  command.run().catch((error) => {
    process.exit(1);
  });
}

export { TokenTransferCommand };