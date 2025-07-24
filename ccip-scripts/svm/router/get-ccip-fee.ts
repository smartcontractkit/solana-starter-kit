/**
 * Solana CCIP Fee Calculation Utility (CLI Framework Version)
 *
 * This script demonstrates how to estimate fees for CCIP cross-chain transactions
 * without actually sending any messages or tokens.
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { AbiCoder } from "ethers";
import {
  CCIPFeeRequest,
  AddressConversion,
  LogLevel,
  createLogger,
  CCIPClient,
} from "../../../ccip-lib/svm";
import {
  ChainId,
  CHAIN_SELECTORS,
  getCCIPSVMConfig,
  resolveNetworkConfig,
  FeeTokenType as ConfigFeeTokenType,
} from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for CCIP fee calculation operations
 */
const FEE_CALC_CONFIG = {
  // Default destination configuration
  defaultDestinationChain: ChainId.ETHEREUM_SEPOLIA,
  defaultEvmReceiverAddress: "0x9d087fC03ae39b088326b67fA3C788236645b717",
  
  // Default token transfer configuration  
  defaultTokenAmount: "10000000", // 0.01 with 9 decimals
  
  // Default fee configuration
  defaultFeeToken: ConfigFeeTokenType.NATIVE,
  
  // Default message configuration
  defaultMessageData: AbiCoder.defaultAbiCoder().encode(["string"], ["Hello World"]),
  
  // Default extra arguments
  defaultGasLimit: 200000,
  defaultAllowOutOfOrder: true,
  
  // System configuration
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the get-ccip-fee command
 */
interface GetCcipFeeOptions extends BaseCommandOptions {
  feeToken?: string;
  destinationChain?: string;
  receiverAddress?: string;
  tokenAmount?: string;
  gasLimit?: number;
  allowOutOfOrder?: boolean;
  messageData?: string;
}

/**
 * CCIP Fee Calculation Command
 */
class GetCcipFeeCommand extends CCIPCommand<GetCcipFeeOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "get-ccip-fee",
      description: "💰 CCIP Fee Calculator\\n\\nEstimates fees for CCIP cross-chain transactions without actually sending any messages or tokens. Useful for planning and budgeting cross-chain operations.",
      examples: [
        "# Basic fee calculation (uses all defaults)",
        "yarn ccip:fee",
        "",
        "# Calculate fee with LINK token as fee payment",
        "yarn ccip:fee --fee-token link",
        "",
        "# Calculate fee for custom token amount",
        "yarn ccip:fee --token-amount 50000000 --gas-limit 300000",
        "",
        "# Calculate fee for custom receiver and message",
        "yarn ccip:fee --receiver-address 0x1234567890123456789012345678901234567890 --message-data \"Custom message data\""
      ],
      notes: [
        `Default destination: ${FEE_CALC_CONFIG.defaultDestinationChain}`,
        `Default token amount: ${FEE_CALC_CONFIG.defaultTokenAmount} (0.01 tokens with 9 decimals)`,
        `Default gas limit: ${FEE_CALC_CONFIG.defaultGasLimit}`,
        "Fee tokens: native (SOL), wrapped-native (wSOL), link, or custom address",
        "No actual transactions are sent - this is estimation only",
        "Results show both raw amounts and formatted values",
        "Useful for budgeting and planning cross-chain operations"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "fee-token",
        required: false,
        type: "string",
        description: `Token to use for fees (native, wrapped-native, link, or address, default: ${FEE_CALC_CONFIG.defaultFeeToken})`,
        example: "link"
      },
      {
        name: "destination-chain", 
        required: false,
        type: "string",
        description: `Destination chain (default: ${FEE_CALC_CONFIG.defaultDestinationChain})`,
        example: "ethereum-sepolia"
      },
      {
        name: "receiver-address",
        required: false,
        type: "string",
        description: `EVM receiver address (default: ${FEE_CALC_CONFIG.defaultEvmReceiverAddress})`,
        example: "0x1234567890123456789012345678901234567890"
      },
      {
        name: "token-amount",
        required: false,
        type: "string",
        description: `Token amount to transfer (default: ${FEE_CALC_CONFIG.defaultTokenAmount})`,
        example: "50000000"
      },
      {
        name: "gas-limit",
        required: false,
        type: "number",
        description: `Gas limit for destination execution (default: ${FEE_CALC_CONFIG.defaultGasLimit})`,
        example: "300000"
      },
      {
        name: "allow-out-of-order",
        required: false,
        type: "boolean",
        description: `Allow out-of-order execution (default: ${FEE_CALC_CONFIG.defaultAllowOutOfOrder})`,
        example: "false"
      },
      {
        name: "message-data",
        required: false,
        type: "string",
        description: "Custom message data (default: ABI-encoded 'Hello World')",
        example: "Custom message content"
      }
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
        this.logger.info(`Using wrapped SOL as fee token: ${NATIVE_MINT.toString()}`);
        return new PublicKey(NATIVE_MINT);
      case "link":
        this.logger.info(`Using LINK token as fee token: ${config.linkTokenMint.toString()}`);
        return new PublicKey(config.linkTokenMint);
      default:
        // Try to parse as custom address
        try {
          const customToken = new PublicKey(feeTokenInput);
          this.logger.info(`Using custom fee token address: ${customToken.toString()}`);
          return customToken;
        } catch {
          this.logger.warn(`Invalid fee token: ${feeTokenInput}, using default native SOL`);
          return PublicKey.default;
        }
    }
  }

  /**
   * Create message configuration from options
   */
  private createMessageConfig(config: any) {
    // Resolve destination chain
    const destinationChain = this.options.destinationChain || FEE_CALC_CONFIG.defaultDestinationChain;
    const destinationChainSelector = CHAIN_SELECTORS[destinationChain as ChainId]?.toString() || 
                                   CHAIN_SELECTORS[FEE_CALC_CONFIG.defaultDestinationChain].toString();

    // Resolve other parameters
    const evmReceiverAddress = this.options.receiverAddress || FEE_CALC_CONFIG.defaultEvmReceiverAddress;
    const tokenAmount = this.options.tokenAmount || FEE_CALC_CONFIG.defaultTokenAmount;
    const gasLimit = this.options.gasLimit ?? FEE_CALC_CONFIG.defaultGasLimit;
    const allowOutOfOrder = this.options.allowOutOfOrder ?? FEE_CALC_CONFIG.defaultAllowOutOfOrder;
    
    // Resolve message data
    let messageData: string;
    if (this.options.messageData) {
      messageData = AbiCoder.defaultAbiCoder().encode(["string"], [this.options.messageData]);
    } else {
      messageData = FEE_CALC_CONFIG.defaultMessageData;
    }

    return {
      destinationChain,
      destinationChainSelector,
      evmReceiverAddress,
      tokenAmount,
      messageData,
      gasLimit,
      allowOutOfOrder,
    };
  }

  /**
   * Display fee calculation parameters
   */
  private displayParameters(messageConfig: any, feeToken: PublicKey): void {
    this.logger.info("📋 FEE CALCULATION PARAMETERS");
    this.logger.info("===========================================");
    this.logger.info(`Destination Chain: ${messageConfig.destinationChain}`);
    this.logger.info(`Destination Chain Selector: ${messageConfig.destinationChainSelector}`);
    this.logger.info(`EVM Receiver Address: ${messageConfig.evmReceiverAddress}`);
    this.logger.info(`Token Amount: ${messageConfig.tokenAmount}`);
    this.logger.info(`Fee Token: ${feeToken.toString()}`);
    this.logger.info(`Message Data Length: ${Buffer.from(messageConfig.messageData).length} bytes`);
    this.logger.info(`Gas Limit: ${messageConfig.gasLimit}`);
    this.logger.info(`Allow Out Of Order Execution: ${messageConfig.allowOutOfOrder}`);
  }

  /**
   * Format and display fee results
   */
  private displayFeeResults(feeResult: any): void {
    this.logger.info("");
    this.logger.info("💰 FEE CALCULATION RESULTS");
    this.logger.info("===========================================");

    const feeTokenResult = new PublicKey(feeResult.token);
    let formattedFee: string;

    if (feeTokenResult.equals(NATIVE_MINT)) {
      formattedFee = `${feeResult.amount.toNumber() / LAMPORTS_PER_SOL} SOL`;
      this.logger.info("Fee is calculated in SOL");
    } else {
      formattedFee = `${feeResult.amount.toString()} (Token: ${feeTokenResult.toString()})`;
      this.logger.info("Fee is calculated in a token other than native SOL");
    }

    this.logger.info(`Estimated Fee: ${formattedFee}`);
    this.logger.info(`Fee in Juels: ${feeResult.juels.toString()}`);
    this.logger.info(`Fee Token: ${feeTokenResult.toString()}`);

    // Additional debug information
    this.logger.debug("");
    this.logger.debug("🔍 ADDITIONAL FEE DETAILS");
    this.logger.debug("===========================================");
    this.logger.debug(`Fee token equals PublicKey.default: ${feeTokenResult.equals(PublicKey.default)}`);
    this.logger.debug(`Fee token equals NATIVE_MINT: ${feeTokenResult.equals(NATIVE_MINT)}`);
    this.logger.debug(`PublicKey.default value: ${PublicKey.default.toString()}`);
    this.logger.debug(`NATIVE_MINT value: ${NATIVE_MINT.toString()}`);
  }

  protected async execute(): Promise<void> {
    this.logger.info("💰 CCIP Fee Calculator");
    this.logger.info("=======================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: devnet`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Display CCIP configuration
    this.logger.info("");
    this.logger.info("🌉 CCIP ROUTER INFORMATION");
    this.logger.info("=======================================");
    this.logger.info(`CCIP Router Program ID: ${config.routerProgramId.toString()}`);
    this.logger.info(`Fee Quoter Program ID: ${config.feeQuoterProgramId.toString()}`);
    this.logger.info(`RMN Remote Program ID: ${config.rmnRemoteProgramId.toString()}`);

    // Create message configuration
    const messageConfig = this.createMessageConfig(config);

    // Resolve fee token
    const feeTokenInput = this.options.feeToken || FEE_CALC_CONFIG.defaultFeeToken;
    const feeToken = this.resolveFeeToken(feeTokenInput, config);

    // Display parameters
    this.logger.info("");
    this.displayParameters(messageConfig, feeToken);

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

      // Convert token amounts to BN values
      const tokenAmounts = [{
        token: new PublicKey(config.bnmTokenMint),
        amount: new anchor.BN(messageConfig.tokenAmount),
      }];

      // Create extra args with forced allowOutOfOrderExecution to avoid error 8030
      const extraArgsConfig = {
        gasLimit: messageConfig.gasLimit,
        allowOutOfOrderExecution: true, // Force to true to avoid FeeQuoter error 8030
      };

      if (!messageConfig.allowOutOfOrder) {
        this.logger.warn("Setting allowOutOfOrderExecution to true to avoid FeeQuoter error 8030");
      }

      const extraArgs = ccipClient.createExtraArgs(extraArgsConfig);
      this.logger.debug(`ExtraArgs buffer (hex): ${extraArgs.toString('hex')}`);

      // Create fee request
      const feeRequest: CCIPFeeRequest = {
        destChainSelector: new anchor.BN(messageConfig.destinationChainSelector),
        message: {
          receiver: receiverBytes,
          data: Buffer.from(messageConfig.messageData),
          tokenAmounts: tokenAmounts,
          feeToken: feeToken,
          extraArgs: extraArgs,
        },
      };

      // Log request details
      this.logger.debug("");
      this.logger.debug("📋 FEE REQUEST DETAILS");
      this.logger.debug("===========================================");
      this.logger.debug(`Destination Chain Selector: ${feeRequest.destChainSelector.toString()}`);
      this.logger.debug(`Receiver (bytes): ${Buffer.from(receiverBytes).toString("hex")}`);
      this.logger.debug(`Token Amounts: ${tokenAmounts.map((ta) => `${ta.amount.toString()} (${ta.token.toString()})`).join(", ")}`);
      this.logger.debug(`Fee Token: ${feeToken.toString()}`);

      // Calculate fee
      this.logger.info("");
      this.logger.info("🔄 CALCULATING FEE");
      this.logger.info("=======================================");
      this.logger.info("Preparing fee request...");

      const feeResult = await ccipClient.getFee(feeRequest);

      // Display results
      this.displayFeeResults(feeResult);

    } catch (error) {
      this.logger.error(
        `❌ Failed to calculate CCIP fee: ${error instanceof Error ? error.message : String(error)}`
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
const command = new GetCcipFeeCommand();
command.run().catch((error) => {
  process.exit(1);
});