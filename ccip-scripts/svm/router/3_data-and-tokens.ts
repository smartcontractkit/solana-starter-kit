/**
 * Solana to Ethereum CCIP Data and Token Transfer Script (CLI Framework Version)
 *
 * This script demonstrates how to send both tokens and arbitrary data from Solana Devnet to Ethereum Sepolia
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { AbiCoder } from "ethers";
import {
  CCIPClient,
  AddressConversion,
  LogLevel,
  createLogger,
  CCIPSendOptions,
} from "../../../ccip-lib/svm";
import {
  ChainId,
  CHAIN_SELECTORS,
  getCCIPSVMConfig,
  resolveNetworkConfig,
  FeeTokenType as ConfigFeeTokenType,
} from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { messageDataToBuffer } from "../utils/token-utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Script configuration parameters
 */
const DATA_AND_TOKENS_CONFIG = {
  computeUnits: 1_400_000,
  minSolRequired: 0.005,
  defaultDestinationChain: ChainId.ETHEREUM_SEPOLIA,
  defaultEvmReceiverAddress: "0x9d087fC03ae39b088326b67fA3C788236645b717",
  defaultTokenAmount: "10000000", // 0.01 tokens with 9 decimals
  defaultMessage: "Hello from Solana!",
  defaultNumber: 42,
  defaultFeeToken: "native",
  defaultGasLimit: 200000,
  defaultAllowOutOfOrder: true,
};

/**
 * Options specific to the data-and-tokens command
 */
interface DataAndTokensOptions extends BaseCommandOptions {
  destinationChain?: string;
  receiverAddress?: string;
  tokenMint?: string;
  tokenAmount?: string;
  message?: string;
  numberValue?: number;
  feeToken?: string;
  gasLimit?: number;
  allowOutOfOrder?: boolean;
}

/**
 * Data and Tokens Transfer Command
 */
class DataAndTokensCommand extends CCIPCommand<DataAndTokensOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "data-and-tokens",
      description: "🚀📨 CCIP Data and Token Transfer\\n\\nSends both tokens and arbitrary data from Solana to Ethereum using CCIP.",
      examples: [
        "# Send default BnM tokens with message using default values",
        "yarn svm:data-and-tokens",
        "",
        "# Send custom token with custom message",
        "yarn svm:data-and-tokens --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --message \"Custom message\" --number-value 123",
        "",
        "# Send to different destination with LINK fees",
        "yarn svm:data-and-tokens --destination-chain ethereum-sepolia --fee-token link",
      ],
      notes: [
        "Combines token transfer with arbitrary data messaging",
        "Message data is ABI-encoded for EVM compatibility",
        "Requires delegation of tokens to fee-billing PDA",
        "Default sends 0.01 BnM tokens with 'Hello from Solana!' message",
        "Gas limit determines execution cost on destination chain"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "destination-chain",
        required: false,
        type: "string",
        description: "Destination chain (ethereum-sepolia)",
        example: "ethereum-sepolia"
      },
      {
        name: "receiver-address",
        required: false,
        type: "string", 
        description: "EVM receiver contract address",
        example: "0x9d087fC03ae39b088326b67fA3C788236645b717"
      },
      {
        name: "token-mint",
        required: false,
        type: "string",
        description: "Token mint address to transfer",
        example: "3PjyGzj1jGVgHSKS4VR1Hr1memm63PmN8L9rtPDKwzZ6"
      },
      {
        name: "token-amount",
        required: false,
        type: "string",
        description: "Token amount to transfer (raw units)",
        example: "10000000"
      },
      {
        name: "message",
        required: false,
        type: "string",
        description: "Message string to send",
        example: "Hello from Solana!"
      },
      {
        name: "number-value",
        required: false,
        type: "number",
        description: "Number value to send",
        example: "42"
      },
      {
        name: "fee-token",
        required: false,
        type: "string",
        description: "Token to use for fees (native, wrapped-native, link, or address)",
        example: "native"
      },
      {
        name: "gas-limit",
        required: false,
        type: "number",
        description: "Gas limit for destination execution",
        example: "200000"
      },
      {
        name: "allow-out-of-order",
        required: false,
        type: "boolean",
        description: "Allow out of order execution",
        example: "true"
      }
    ];
  }

  /**
   * Create message configuration from options
   */
  private createMessageConfig(config: any) {
    // Resolve destination chain
    const destinationChain = this.options.destinationChain || DATA_AND_TOKENS_CONFIG.defaultDestinationChain;
    const destinationChainSelector = CHAIN_SELECTORS[destinationChain as ChainId]?.toString() || 
                                   CHAIN_SELECTORS[DATA_AND_TOKENS_CONFIG.defaultDestinationChain].toString();

    // Resolve other parameters
    const evmReceiverAddress = this.options.receiverAddress || DATA_AND_TOKENS_CONFIG.defaultEvmReceiverAddress;
    const tokenMint = this.options.tokenMint ? 
      new PublicKey(this.options.tokenMint) : 
      new PublicKey(config.bnmTokenMint);
    const tokenAmount = this.options.tokenAmount || DATA_AND_TOKENS_CONFIG.defaultTokenAmount;
    const message = this.options.message || DATA_AND_TOKENS_CONFIG.defaultMessage;
    const numberValue = this.options.numberValue ?? DATA_AND_TOKENS_CONFIG.defaultNumber;
    const gasLimit = this.options.gasLimit ?? DATA_AND_TOKENS_CONFIG.defaultGasLimit;
    const allowOutOfOrder = this.options.allowOutOfOrder ?? DATA_AND_TOKENS_CONFIG.defaultAllowOutOfOrder;

    // ABI-encode the message data for EVM compatibility (string + uint256)
    const messageData = AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256"],
      [message, BigInt(numberValue)]
    );

    return {
      destinationChain,
      destinationChainSelector,
      evmReceiverAddress,
      tokenMint,
      tokenAmount,
      message,
      numberValue,
      messageData,
      gasLimit,
      allowOutOfOrder,
    };
  }

  /**
   * Resolve fee token from input string
   */
  private resolveFeeToken(feeTokenInput: string, config: any): PublicKey {
    switch (feeTokenInput.toLowerCase()) {
      case "native":
        return PublicKey.default;
      case "wrapped-native":
        return new PublicKey(NATIVE_MINT);
      case "link":
        return new PublicKey(config.linkTokenMint);
      default:
        // Assume it's a token mint address
        try {
          return new PublicKey(feeTokenInput);
        } catch (error) {
          throw new Error(`Invalid fee token: ${feeTokenInput}`);
        }
    }
  }

  /**
   * Display transfer parameters
   */
  private displayTransferParameters(messageConfig: any, feeToken: PublicKey): void {
    this.logger.info("📋 DATA AND TOKEN TRANSFER PARAMETERS");
    this.logger.info("===========================================");
    this.logger.info(`Destination Chain: ${messageConfig.destinationChain}`);
    this.logger.info(`Destination Chain Selector: ${messageConfig.destinationChainSelector}`);
    this.logger.info(`EVM Receiver Address: ${messageConfig.evmReceiverAddress}`);
    this.logger.info(`Token Mint: ${messageConfig.tokenMint.toString()}`);
    this.logger.info(`Token Amount: ${messageConfig.tokenAmount}`);
    this.logger.info(`Message: "${messageConfig.message}"`);
    this.logger.info(`Number Value: ${messageConfig.numberValue}`);
    this.logger.info(`Message Data Length: ${messageConfig.messageData.length} bytes`);
    this.logger.info(`Fee Token: ${feeToken.toString()}`);
    this.logger.info(`Gas Limit: ${messageConfig.gasLimit}`);
    this.logger.info(`Allow Out Of Order Execution: ${messageConfig.allowOutOfOrder}`);
  }

  protected async execute(): Promise<void> {
    this.logger.info("🚀📨 CCIP Data and Token Transfer");
    this.logger.info("=======================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("=======================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (balance < DATA_AND_TOKENS_CONFIG.minSolRequired * LAMPORTS_PER_SOL) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${DATA_AND_TOKENS_CONFIG.minSolRequired} SOL for transaction fees. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

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
    const feeTokenInput = this.options.feeToken || DATA_AND_TOKENS_CONFIG.defaultFeeToken;
    const feeToken = this.resolveFeeToken(feeTokenInput, config);

    // Display transfer parameters
    this.logger.info("");
    this.displayTransferParameters(messageConfig, feeToken);

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
        token: messageConfig.tokenMint,
        amount: new anchor.BN(messageConfig.tokenAmount),
      }];

      // Create extra args
      const extraArgs = ccipClient.createExtraArgs({
        gasLimit: messageConfig.gasLimit,
        allowOutOfOrderExecution: messageConfig.allowOutOfOrder,
      });

      // Send CCIP message with both data and tokens
      this.logger.info("");
      this.logger.info("🔄 SENDING DATA AND TOKEN TRANSFER");
      this.logger.info("=======================================");
      this.logger.info("Preparing CCIP message with both tokens and data...");

      // Create compute budget instruction - use the same approach as the executor
      const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit({
        units: DATA_AND_TOKENS_CONFIG.computeUnits,
      });
      this.logger.debug(`Added compute budget instruction with limit: ${DATA_AND_TOKENS_CONFIG.computeUnits} units`);

      // Create send options exactly like the executor does
      const sendOptions: CCIPSendOptions | undefined = this.options.skipPreflight
        ? { skipPreflight: true }
        : undefined;

      const result = await ccipClient.sendWithMessageId(
        {
          destChainSelector: new anchor.BN(messageConfig.destinationChainSelector),
          receiver: receiverBytes,
          data: messageDataToBuffer(messageConfig.messageData), // Properly handle hex-encoded ABI data
          tokenAmounts: tokenAmounts, // Token transfers
          feeToken: feeToken,
          extraArgs: extraArgs,
        },
        computeBudgetInstruction, // Compute budget instruction like executor
        sendOptions // Send options like executor
      );

      // Display results
      this.logger.info("");
      this.logger.info("✅ DATA AND TOKEN TRANSFER SENT SUCCESSFULLY");
      this.logger.info("=======================================");
      this.logger.info(`Transaction Signature: ${result.txSignature}`);
      this.logger.info(`CCIP Message ID: ${result.messageId || 'N/A'}`);

      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("=======================================");
      const explorerCluster = config.id === 'solana-mainnet' ? '' : '?cluster=devnet';
      this.logger.info(`Solana Transaction: https://explorer.solana.com/tx/${result.txSignature}${explorerCluster}`);
      if (result.messageId) {
        this.logger.info(`CCIP Explorer: https://ccip.chain.link/msg/${result.messageId}`);
      }

      this.logger.info("");
      this.logger.info("🎉 Transfer Complete!");
      this.logger.info(`✅ Sent ${messageConfig.tokenAmount} tokens with message: "${messageConfig.message}"`);
      this.logger.info(`✅ To receiver: ${messageConfig.evmReceiverAddress}`);
      if (result.messageId) {
        this.logger.info(`✅ Message ID: ${result.messageId}`);
        this.logger.info(`✅ Monitor progress on CCIP Explorer: https://ccip.chain.link/msg/${result.messageId}`);
      }

    } catch (error) {
      this.logger.error(
        `❌ Failed to send data and token transfer: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new DataAndTokensCommand();
command.run().catch((error) => {
  process.exit(1);
});