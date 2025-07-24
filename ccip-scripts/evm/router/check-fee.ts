/**
 * EVM CCIP Fee Estimation (CLI Framework Version) 
 * 
 * This script demonstrates read-only fee estimation for CCIP messages.
 * Check estimated fees without actually sending transactions.
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
import { ethers } from "ethers";
import { createLogger, LogLevel, CCIPMessenger } from "../../../ccip-lib/evm";
import { ChainId, getEVMConfig, CHAIN_SELECTORS } from "../../config";
import { createCCIPMessageRequest } from "../utils/message-utils";
// Import to ensure environment variables are loaded
import "../utils/config-parser";
import { PublicKey } from "@solana/web3.js";

/**
 * Options specific to the fee check command
 */
interface CheckFeeOptions extends BaseCommandOptions {
  // Fee check specific options
  sourceChain?: ChainId;
  destinationChain?: ChainId;
  simulatedAmount?: string;
  simulatedToken?: string;
}

/**
 * CCIP Fee Check Command Implementation
 */
class CheckFeeCommand extends CCIPCommand<CheckFeeOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "check-fee",
      description:
        "💰 EVM CCIP Fee Estimation\n\nEstimate CCIP fees for cross-chain transfers without sending transactions. Perfect for cost planning and fee analysis.",
      examples: [
        "# Check default BnM token transfer fee",
        "yarn evm:check-fee",
        "",
        "# Check fee for custom token amount",
        "yarn evm:check-fee --amount 1000000000000000000 --token 0x779877A7B0D9E8603169DdbD7836e478b4624789",
        "",
        "# Check fees with different fee tokens",
        "yarn evm:check-fee --fee-token native --log-level DEBUG",
        "",
        "# Check fee for data message (no tokens)",
        'yarn evm:check-fee --data "Hello Solana" --token-amounts ""',
        "",
        "# Check fee from different source chain",
        "yarn evm:check-fee --source-chain avalanche-fuji",
      ],
      notes: [
        "No private key required - read-only operation",
        "No transactions are sent - only fee estimation",
        "Default source chain is Ethereum Sepolia",
        "Default destination is Solana Devnet",
        "Simulates BnM token transfer by default",
        "Useful for cost planning before actual transfers",
        "Shows fees in both native tokens and USD (when available)",
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
        description: "Source chain to check fees from",
        defaultValue: ChainId.ETHEREUM_SEPOLIA,
        example: "ethereum-sepolia",
      },
      {
        name: "destination-chain",
        aliases: ["dest"],
        type: "string",
        description: "Destination chain to send to",
        defaultValue: ChainId.SOLANA_DEVNET,
        example: "solana-devnet",
      },
      {
        name: "token",
        aliases: ["t"],
        type: "string",
        description: "Token address for fee simulation",
        example: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      },
      {
        name: "amount",
        aliases: ["a"],
        type: "string",
        description: "Token amount for fee simulation (with decimals)",
        defaultValue: "10000000000000000", // 0.01 token with 18 decimals
        example: "1000000000000000000",
      },
      {
        name: "data",
        aliases: ["d"],
        type: "string",
        description: "Message data for fee simulation",
        defaultValue: "0x",
        example: "Hello Solana",
      },
    ];
  }

  /**
   * Get default token for fee simulation based on source chain
   */
  private getDefaultTokenForSimulation(): { token: string; amount: string } {
    const sourceChainConfig = getEVMConfig(this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA);
    
    return {
      token: sourceChainConfig.bnmTokenAddress,
      amount: this.options.simulatedAmount || "10000000000000000", // 0.01 BnM
    };
  }

  protected async execute(): Promise<void> {
    this.logger.info("💰 EVM CCIP Fee Estimation");
    this.logger.info("=========================================");

    try {
      // Configuration
      const sourceChain = this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA;
      const destinationChain = this.options.destinationChain || ChainId.SOLANA_DEVNET;
      const sourceConfig = getEVMConfig(sourceChain);

      this.logger.info(`Source Chain: ${sourceChain}`);
      this.logger.info(`Destination Chain: ${destinationChain}`);
      this.logger.info(`Router Address: ${sourceConfig.routerAddress}`);

      // Determine token amounts for simulation
      let tokenAmounts: Array<{ token: string; amount: string }> = [];

      if (this.options.tokenAmounts && this.options.tokenAmounts.length > 0) {
        tokenAmounts = this.options.tokenAmounts;
      } else if (this.options.token && this.options.amount) {
        tokenAmounts = [{ token: this.options.token, amount: this.options.amount }];
      } else if (this.options.data === "0x") {
        // Default to BnM token simulation if no custom data
        const defaultToken = this.getDefaultTokenForSimulation();
        tokenAmounts = [defaultToken];
        this.logger.info("Using default BnM token for fee simulation");
      }

      // Prepare message data
      const messageData = this.options.data || "0x";
      const hexData = messageData.startsWith("0x") 
        ? messageData 
        : "0x" + Buffer.from(messageData).toString("hex");

      this.logger.info(`Simulating ${tokenAmounts.length} token(s)`);
      this.logger.info(`Message Data: ${messageData === "0x" ? "(none)" : messageData}`);

      this.logger.info("\n📊 Creating Fee Simulation");
      this.logger.info("=========================================");

      // Create a read-only provider (no private key needed)
      const provider = new ethers.JsonRpcProvider(sourceConfig.rpcUrl);
      
      // Create CCIPMessenger context (same as legacy script)
      const context = {
        provider: { provider }, // Read-only provider
        config: {
          routerAddress: sourceConfig.routerAddress,
          tokenAdminRegistryAddress: sourceConfig.tokenAdminRegistryAddress,
        },
        logger: this.logger,
      };
      
      const client = new CCIPMessenger(context);

      // Prepare simulation options
      const simulationOptions = {
        tokenAmounts,
        feeToken: this.options.feeToken || "link", // Default to LINK for fee estimation
        data: hexData,
        receiver: PublicKey.default.toString(), // Use default receiver for simulation
        tokenReceiver: "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB",
        computeUnits: 0, // Default compute units for simulation
        allowOutOfOrderExecution: true,
        accountIsWritableBitmap: BigInt(0),
        accounts: [],
        chainId: sourceChain,
      };

      // Create CCIP message request for fee estimation
      const messageRequest = createCCIPMessageRequest(sourceConfig, simulationOptions, this.logger);

      this.logger.info("✅ Simulation message created");
      
      // Log message request details in debug mode with proper BigInt handling
      if (this.options.logLevel === LogLevel.DEBUG) {
        const debugRequest = {
          destinationChainSelector: messageRequest.destinationChainSelector.toString(),
          receiver: messageRequest.receiver,
          tokenAmounts: messageRequest.tokenAmounts?.map(t => ({
            token: t.token,
            amount: t.amount.toString()
          })),
          feeToken: messageRequest.feeToken,
          data: messageRequest.data,
          extraArgs: messageRequest.extraArgs
        };
        this.logger.debug("Message request:", JSON.stringify(debugRequest, null, 2));
      }

      this.logger.info("\n💰 Estimating CCIP Fees");
      this.logger.info("=========================================");
      this.logger.info("Fetching fee estimate from CCIP router...");

      // Get fee estimate using the same pattern as legacy script
      const feeResult = await client.getFee({
        destinationChainSelector: messageRequest.destinationChainSelector,
        message: {
          receiver: messageRequest.receiver,
          data: messageRequest.data || "0x",
          tokenAmounts: messageRequest.tokenAmounts || [],
          feeToken: messageRequest.feeToken,
          extraArgs: messageRequest.extraArgs,
        },
      });

      this.logger.info("\n🎯 Fee Estimation Results");
      this.logger.info("=========================================");
      
      // Display fee information (using correct property names from legacy script)
      this.logger.info(`💎 Total Fee: ${ethers.formatUnits(feeResult.amount, 18)} LINK`);
      this.logger.info(`🔗 Fee in Wei: ${feeResult.amount.toString()}`);
      this.logger.info(`💰 Fee Token Address: ${feeResult.token}`);

      // Provide context about the fee
      this.logger.info("\n📋 Fee Breakdown Context");
      this.logger.info("=========================================");
      this.logger.info("• Base CCIP protocol fee");
      this.logger.info("• Token transfer execution costs");
      this.logger.info("• Destination chain processing fees");
      this.logger.info("• Network congestion adjustments");

      this.logger.info("\n💡 Fee Optimization Tips");
      this.logger.info("=========================================");
      this.logger.info("• Use LINK token for potential fee discounts");
      this.logger.info("• Bundle multiple operations to reduce per-transfer costs");
      this.logger.info("• Monitor network congestion for optimal timing");
      this.logger.info("• Consider gas price when choosing fee payment method");

      this.logger.info("\n✅ Fee Estimation Complete!");
      this.logger.info("🔍 No transactions were sent - read-only operation");

    } catch (error) {
      this.logger.error(
        `❌ Fee estimation failed: ${
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
  const command = new CheckFeeCommand();
  command.run().catch((error) => {
    process.exit(1);
  });
}

export { CheckFeeCommand };