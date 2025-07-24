/**
 * Solana to Ethereum CCIP Arbitrary Messaging Script (CLI Framework Version)
 *
 * This script demonstrates how to send arbitrary messages from Solana Devnet to Ethereum Sepolia
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 */

import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { AbiCoder } from "ethers";
import { CCIPClient, AddressConversion, LogLevel } from "../../../ccip-lib/svm";
import {
  ChainId,
  CHAIN_SELECTORS,
  resolveNetworkConfig,
  FeeTokenType as ConfigFeeTokenType,
  getExplorerUrl,
} from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { messageDataToBuffer } from "../utils/token-utils";
import {
  CCIPCommand,
  ArgumentDefinition,
  CommandMetadata,
  BaseCommandOptions,
} from "../utils/cli-framework";

/**
 * Configuration for arbitrary messaging operations
 */
const ARBITRARY_MESSAGING_CONFIG = {
  // Default destination configuration
  defaultDestinationChain: ChainId.ETHEREUM_SEPOLIA,
  defaultEvmReceiverAddress: "0x9d087fC03ae39b088326b67fA3C788236645b717",

  // Default message configuration
  defaultMessage: "Hello World",

  // Default fee configuration
  defaultFeeToken: ConfigFeeTokenType.NATIVE,

  // Default extra arguments
  defaultGasLimit: 200000, // Gas limit for message execution on destination chain
  defaultAllowOutOfOrder: true,

  // System configuration
  computeUnits: 1_400_000,
  minSolRequired: 0.005,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the arbitrary-messaging command
 */
interface ArbitraryMessagingOptions extends BaseCommandOptions {
  feeToken?: string;
  destinationChain?: string;
  receiverAddress?: string;
  message?: string;
  gasLimit?: number;
  allowOutOfOrder?: boolean;
}

/**
 * CCIP Arbitrary Messaging Command
 */
class ArbitraryMessagingCommand extends CCIPCommand<ArbitraryMessagingOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "arbitrary-messaging",
      description:
        "📨 CCIP Arbitrary Messaging\\\\n\\\\nSends arbitrary messages from Solana to Ethereum using Chainlink CCIP (Cross-Chain Interoperability Protocol). Demonstrates cross-chain messaging with custom data payloads.",
      examples: [
        "# Basic message sending (uses default 'Hello World')",
        "yarn ccip:message",
        "",
        "# Send custom message with LINK fee token",
        'yarn ccip:message --message \\"Custom cross-chain message\\" --fee-token link',
        "",
        "# Send message with custom gas limit",
        'yarn ccip:message --message \\"High gas message\\" --gas-limit 500000',
        "",
        "# Send message to custom receiver address",
        'yarn ccip:message --receiver-address 0x1234567890123456789012345678901234567890 --message \\"Hello custom receiver!\\"',
      ],
      notes: [
        `Default destination: ${ARBITRARY_MESSAGING_CONFIG.defaultDestinationChain}`,
        `Default message: "${ARBITRARY_MESSAGING_CONFIG.defaultMessage}"`,
        `Default gas limit: ${ARBITRARY_MESSAGING_CONFIG.defaultGasLimit}`,
        `Minimum ${ARBITRARY_MESSAGING_CONFIG.minSolRequired} SOL required for transaction fees`,
        "Fee tokens: native (SOL), wrapped-native (wSOL), link, or custom address",
        "Messages are ABI-encoded for EVM compatibility",
        "Gas limit determines execution cost on destination chain",
        "Transaction includes comprehensive fee calculation and monitoring",
        "Use Chainlink CCIP Explorer to track cross-chain message status",
      ],
    };

    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "fee-token",
        required: false,
        type: "string",
        description: `Token to use for fees (native, wrapped-native, link, or address, default: ${ARBITRARY_MESSAGING_CONFIG.defaultFeeToken})`,
        example: "link",
      },
      {
        name: "destination-chain",
        required: false,
        type: "string",
        description: `Destination chain (default: ${ARBITRARY_MESSAGING_CONFIG.defaultDestinationChain})`,
        example: "ethereum-sepolia",
      },
      {
        name: "receiver-address",
        required: false,
        type: "string",
        description: `EVM receiver address (default: ${ARBITRARY_MESSAGING_CONFIG.defaultEvmReceiverAddress})`,
        example: "0x1234567890123456789012345678901234567890",
      },
      {
        name: "message",
        required: false,
        type: "string",
        description: `Message to send (default: "${ARBITRARY_MESSAGING_CONFIG.defaultMessage}")`,
        example: "Custom cross-chain message",
      },
      {
        name: "gas-limit",
        required: false,
        type: "number",
        description: `Gas limit for destination execution (default: ${ARBITRARY_MESSAGING_CONFIG.defaultGasLimit})`,
        example: "500000",
      },
      {
        name: "allow-out-of-order",
        required: false,
        type: "boolean",
        description: `Allow out-of-order execution (default: ${ARBITRARY_MESSAGING_CONFIG.defaultAllowOutOfOrder})`,
        example: "false",
      },
    ];
  }

  /**
   * Resolve fee token from string input
   */
  private resolveFeeToken(feeTokenInput: string, config: any): PublicKey {
    switch (feeTokenInput.toLowerCase()) {
      case "native":
        this.logger.info("Using native SOL as fee token");
        return PublicKey.default;
      case "wrapped-native":
        this.logger.info(
          `Using wrapped SOL as fee token: ${NATIVE_MINT.toString()}`
        );
        return new PublicKey(NATIVE_MINT);
      case "link":
        this.logger.info(
          `Using LINK token as fee token: ${config.linkTokenMint.toString()}`
        );
        return new PublicKey(config.linkTokenMint);
      default:
        // Try to parse as custom address
        try {
          const customToken = new PublicKey(feeTokenInput);
          this.logger.info(
            `Using custom fee token address: ${customToken.toString()}`
          );
          return customToken;
        } catch {
          this.logger.warn(
            `Invalid fee token: ${feeTokenInput}, using default native SOL`
          );
          return PublicKey.default;
        }
    }
  }

  /**
   * Create message configuration from options
   */
  private createMessageConfig(config: any) {
    // Resolve destination chain
    const destinationChain =
      this.options.destinationChain ||
      ARBITRARY_MESSAGING_CONFIG.defaultDestinationChain;
    const destinationChainSelector =
      CHAIN_SELECTORS[destinationChain as ChainId]?.toString() ||
      CHAIN_SELECTORS[
        ARBITRARY_MESSAGING_CONFIG.defaultDestinationChain
      ].toString();

    // Resolve other parameters
    const evmReceiverAddress =
      this.options.receiverAddress ||
      ARBITRARY_MESSAGING_CONFIG.defaultEvmReceiverAddress;
    const message =
      this.options.message || ARBITRARY_MESSAGING_CONFIG.defaultMessage;
    const gasLimit =
      this.options.gasLimit ?? ARBITRARY_MESSAGING_CONFIG.defaultGasLimit;
    const allowOutOfOrder =
      this.options.allowOutOfOrder ??
      ARBITRARY_MESSAGING_CONFIG.defaultAllowOutOfOrder;

    // ABI-encode the message for EVM compatibility
    const messageData = AbiCoder.defaultAbiCoder().encode(
      ["string"],
      [message]
    );

    return {
      destinationChain,
      destinationChainSelector,
      evmReceiverAddress,
      message,
      messageData,
      gasLimit,
      allowOutOfOrder,
    };
  }

  /**
   * Display messaging parameters
   */
  private displayMessagingParameters(
    messageConfig: any,
    feeToken: PublicKey
  ): void {
    this.logger.info("📋 ARBITRARY MESSAGING PARAMETERS");
    this.logger.info("===========================================");
    this.logger.info(`Destination Chain: ${messageConfig.destinationChain}`);
    this.logger.info(
      `Destination Chain Selector: ${messageConfig.destinationChainSelector}`
    );
    this.logger.info(
      `EVM Receiver Address: ${messageConfig.evmReceiverAddress}`
    );
    this.logger.info(`Message: "${messageConfig.message}"`);
    this.logger.info(
      `Message Data Length: ${
        Buffer.from(messageConfig.messageData).length
      } bytes`
    );
    this.logger.info(`Fee Token: ${feeToken.toString()}`);
    this.logger.info(`Gas Limit: ${messageConfig.gasLimit}`);
    this.logger.info(
      `Allow Out Of Order Execution: ${messageConfig.allowOutOfOrder}`
    );
  }

  protected async execute(): Promise<void> {
    this.logger.info("📨 CCIP Arbitrary Messaging");
    this.logger.info("=======================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);

    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);

    this.logger.info(`Network: devnet`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("=======================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(
      `SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`
    );

    if (solBalanceDisplay < ARBITRARY_MESSAGING_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${ARBITRARY_MESSAGING_CONFIG.minSolRequired} SOL for transaction fees. ` +
          `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Display CCIP configuration
    this.logger.info("");
    this.logger.info("🌉 CCIP ROUTER INFORMATION");
    this.logger.info("=======================================");
    this.logger.info(
      `CCIP Router Program ID: ${config.routerProgramId.toString()}`
    );
    this.logger.info(
      `Fee Quoter Program ID: ${config.feeQuoterProgramId.toString()}`
    );
    this.logger.info(
      `RMN Remote Program ID: ${config.rmnRemoteProgramId.toString()}`
    );

    // Create message configuration
    const messageConfig = this.createMessageConfig(config);

    // Resolve fee token
    const feeTokenInput =
      this.options.feeToken || ARBITRARY_MESSAGING_CONFIG.defaultFeeToken;
    const feeToken = this.resolveFeeToken(feeTokenInput, config);

    // Display messaging parameters
    this.logger.info("");
    this.displayMessagingParameters(messageConfig, feeToken);

    try {
      // Create CCIP client
      const ccipClient = CCIPClient.create(
        config.connection,
        walletKeypair,
        {
          ccipRouterProgramId: config.routerProgramId.toString(),
          feeQuoterProgramId: config.feeQuoterProgramId.toString(),
          rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
          linkTokenMint: config.linkTokenMint.toString(),
          tokenMint: config.bnmTokenMint.toString(),
          receiverProgramId: config.receiverProgramId.toString(),
        },
        { logLevel: this.options.logLevel }
      );

      // Convert EVM address to Solana bytes
      const receiverBytes = AddressConversion.evmAddressToSolanaBytes(
        messageConfig.evmReceiverAddress
      );

      // Create extra args
      const extraArgs = ccipClient.createExtraArgs({
        gasLimit: messageConfig.gasLimit,
        allowOutOfOrderExecution: messageConfig.allowOutOfOrder,
      });

      // Send CCIP message
      this.logger.info("");
      this.logger.info("🔄 SENDING ARBITRARY MESSAGE");
      this.logger.info("=======================================");
      this.logger.info("Preparing CCIP message...");

      // Create compute budget instruction for the transaction
      const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit(
        {
          units: 1_400_000, // Increase compute budget for complex CCIP transactions
        }
      );
      this.logger.debug(
        `Added compute budget instruction with limit: 1,400,000 units`
      );

      const result = await ccipClient.sendWithMessageId(
        {
          destChainSelector: new anchor.BN(
            messageConfig.destinationChainSelector
          ),
          receiver: receiverBytes,
          data: messageDataToBuffer(messageConfig.messageData), // Properly handle hex-encoded ABI data
          tokenAmounts: [], // No tokens for arbitrary messaging
          feeToken: feeToken,
          extraArgs: extraArgs,
        },
        computeBudgetInstruction, // Add compute budget instruction
        {
          skipPreflight: this.options.skipPreflight,
        }
      );

      // Display results
      this.logger.info("");
      this.logger.info("✅ ARBITRARY MESSAGE SENT SUCCESSFULLY");
      this.logger.info("=======================================");
      this.logger.info(`Transaction Signature: ${result.txSignature}`);
      this.logger.info(`CCIP Message ID: ${result.messageId}`);

      // Display explorer URLs
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("=======================================");
      this.logger.info(
        `Solana Transaction: ${getExplorerUrl(config.id, result.txSignature)}`
      );
      this.logger.info(
        `CCIP Explorer: https://ccip.chain.link/msg/${result.messageId}`
      );

      this.logger.info("");
      this.logger.info("🎉 Message Sent Complete!");
      this.logger.info(`✅ Sent message: "${messageConfig.message}"`);
      this.logger.info(`✅ To receiver: ${messageConfig.evmReceiverAddress}`);
      this.logger.info(`✅ Message ID: ${result.messageId}`);
      this.logger.info(
        `✅ Monitor progress on CCIP Explorer: https://ccip.chain.link/msg/${result.messageId}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send arbitrary message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\\nError stack:");
        this.logger.debug(error.stack);

        // Check for context in enhanced errors from SDK
        if ((error as any).context) {
          this.logger.error("\\nError Context:");
          this.logger.error(JSON.stringify((error as any).context, null, 2));
        }
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new ArbitraryMessagingCommand();
command.run().catch((error) => {
  process.exit(1);
});
