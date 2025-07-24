/**
 * Solana to Ethereum CCIP Token Transfer Script (CLI Framework Version)
 *
 * This script demonstrates how to send tokens from Solana Devnet to Ethereum Sepolia
 * using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
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
  getExplorerUrl,
} from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for token transfer operations
 */
const TOKEN_TRANSFER_CONFIG = {
  // Default destination configuration
  defaultDestinationChain: ChainId.ETHEREUM_SEPOLIA,
  defaultEvmReceiverAddress: "0x9d087fC03ae39b088326b67fA3C788236645b717",
  
  // Default token transfer configuration  
  defaultTokenAmount: "10000000", // 0.01 with 9 decimals
  
  // Default fee configuration
  defaultFeeToken: ConfigFeeTokenType.NATIVE,
  
  // Default extra arguments
  defaultGasLimit: 0, // No execution on destination for token transfers
  defaultAllowOutOfOrder: true,
  
  // System configuration
  computeUnits: 1_400_000,
  minSolRequired: 0.005,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the token-transfer command
 */
interface TokenTransferOptions extends BaseCommandOptions {
  feeToken?: string;
  destinationChain?: string;
  receiverAddress?: string;
  tokenMint?: string;
  tokenAmount?: string;
  gasLimit?: number;
  allowOutOfOrder?: boolean;
}

/**
 * CCIP Token Transfer Command
 */
class TokenTransferCommand extends CCIPCommand<TokenTransferOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "token-transfer",
      description: "🚀 CCIP Token Transfer\\\\n\\\\nSends tokens from Solana to Ethereum using Chainlink CCIP (Cross-Chain Interoperability Protocol). Demonstrates cross-chain token transfers with comprehensive fee calculation and transaction monitoring.",
      examples: [
        "# Basic token transfer (uses BnM token from config)",
        "yarn ccip:send",
        "",
        "# Transfer with LINK token as fee payment",
        "yarn ccip:send --fee-token link",
        "",
        "# Transfer custom token with custom amount",
        "yarn ccip:send --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --token-amount 50000000",
        "",
        "# Transfer to custom receiver address",
        "yarn ccip:send --receiver-address 0x1234567890123456789012345678901234567890 --token-amount 25000000"
      ],
      notes: [
        `Default destination: ${TOKEN_TRANSFER_CONFIG.defaultDestinationChain}`,
        `Default token amount: ${TOKEN_TRANSFER_CONFIG.defaultTokenAmount} (0.01 tokens with 9 decimals)`,
        `Minimum ${TOKEN_TRANSFER_CONFIG.minSolRequired} SOL required for transaction fees`,
        "Fee tokens: native (SOL), wrapped-native (wSOL), link, or custom address",
        "Ensure you have sufficient token balance before transferring",
        "Gas limit of 0 means no execution on destination (pure token transfer)",
        "Transaction includes comprehensive fee calculation and monitoring",
        "Use Chainlink CCIP Explorer to track cross-chain message status"
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
        description: `Token to use for fees (native, wrapped-native, link, or address, default: ${TOKEN_TRANSFER_CONFIG.defaultFeeToken})`,
        example: "link"
      },
      {
        name: "destination-chain", 
        required: false,
        type: "string",
        description: `Destination chain (default: ${TOKEN_TRANSFER_CONFIG.defaultDestinationChain})`,
        example: "ethereum-sepolia"
      },
      {
        name: "receiver-address",
        required: false,
        type: "string",
        description: `EVM receiver address (default: ${TOKEN_TRANSFER_CONFIG.defaultEvmReceiverAddress})`,
        example: "0x1234567890123456789012345678901234567890"
      },
      {
        name: "token-mint",
        required: false,
        type: "string",
        description: "Token mint address to transfer (default: uses BnM token from config)",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "token-amount",
        required: false,
        type: "string",
        description: `Token amount to transfer (default: ${TOKEN_TRANSFER_CONFIG.defaultTokenAmount})`,
        example: "50000000"
      },
      {
        name: "gas-limit",
        required: false,
        type: "number",
        description: `Gas limit for destination execution (default: ${TOKEN_TRANSFER_CONFIG.defaultGasLimit})`,
        example: "200000"
      },
      {
        name: "allow-out-of-order",
        required: false,
        type: "boolean",
        description: `Allow out-of-order execution (default: ${TOKEN_TRANSFER_CONFIG.defaultAllowOutOfOrder})`,
        example: "false"
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
    const destinationChain = this.options.destinationChain || TOKEN_TRANSFER_CONFIG.defaultDestinationChain;
    const destinationChainSelector = CHAIN_SELECTORS[destinationChain as ChainId]?.toString() || 
                                   CHAIN_SELECTORS[TOKEN_TRANSFER_CONFIG.defaultDestinationChain].toString();

    // Resolve other parameters
    const evmReceiverAddress = this.options.receiverAddress || TOKEN_TRANSFER_CONFIG.defaultEvmReceiverAddress;
    const tokenMint = this.options.tokenMint ? 
      new PublicKey(this.options.tokenMint) : 
      new PublicKey(config.bnmTokenMint);
    const tokenAmount = this.options.tokenAmount || TOKEN_TRANSFER_CONFIG.defaultTokenAmount;
    const gasLimit = this.options.gasLimit ?? TOKEN_TRANSFER_CONFIG.defaultGasLimit;
    const allowOutOfOrder = this.options.allowOutOfOrder ?? TOKEN_TRANSFER_CONFIG.defaultAllowOutOfOrder;

    return {
      destinationChain,
      destinationChainSelector,
      evmReceiverAddress,
      tokenMint,
      tokenAmount,
      gasLimit,
      allowOutOfOrder,
    };
  }

  /**
   * Display transfer parameters
   */
  private displayTransferParameters(messageConfig: any, feeToken: PublicKey): void {
    this.logger.info("📋 TOKEN TRANSFER PARAMETERS");
    this.logger.info("===========================================");
    this.logger.info(`Destination Chain: ${messageConfig.destinationChain}`);
    this.logger.info(`Destination Chain Selector: ${messageConfig.destinationChainSelector}`);
    this.logger.info(`EVM Receiver Address: ${messageConfig.evmReceiverAddress}`);
    this.logger.info(`Token Mint: ${messageConfig.tokenMint.toString()}`);
    this.logger.info(`Token Amount: ${messageConfig.tokenAmount}`);
    this.logger.info(`Fee Token: ${feeToken.toString()}`);
    this.logger.info(`Gas Limit: ${messageConfig.gasLimit}`);
    this.logger.info(`Allow Out Of Order Execution: ${messageConfig.allowOutOfOrder}`);
  }

  protected async execute(): Promise<void> {
    this.logger.info("🚀 CCIP Token Transfer");
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
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < TOKEN_TRANSFER_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${TOKEN_TRANSFER_CONFIG.minSolRequired} SOL for transaction fees. ` +
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
    const feeTokenInput = this.options.feeToken || TOKEN_TRANSFER_CONFIG.defaultFeeToken;
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

      // Send CCIP message
      this.logger.info("");
      this.logger.info("🔄 SENDING TOKEN TRANSFER");
      this.logger.info("=======================================");
      this.logger.info("Preparing CCIP message...");

      // Create compute budget instruction for the transaction
      const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_400_000, // Increase compute budget for complex CCIP transactions
      });
      this.logger.debug(`Added compute budget instruction with limit: 1,400,000 units`);

      const result = await ccipClient.sendWithMessageId(
        {
          destChainSelector: new anchor.BN(messageConfig.destinationChainSelector),
          receiver: receiverBytes,
          data: Buffer.from(""), // Empty data for token transfer
          tokenAmounts: tokenAmounts,
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
      this.logger.info("✅ TOKEN TRANSFER SENT SUCCESSFULLY");
      this.logger.info("=======================================");
      this.logger.info(`Transaction Signature: ${result.txSignature}`);
      this.logger.info(`CCIP Message ID: ${result.messageId}`);

      // Display explorer URLs
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("=======================================");
      this.logger.info(`Solana Transaction: ${getExplorerUrl(config.id, result.txSignature)}`);
      this.logger.info(`CCIP Explorer: https://ccip.chain.link/msg/${result.messageId}`);

      this.logger.info("");
      this.logger.info("🎉 Transfer Complete!");
      this.logger.info(`✅ Sent ${messageConfig.tokenAmount} tokens to ${messageConfig.evmReceiverAddress}`);
      this.logger.info(`✅ Message ID: ${result.messageId}`);
      this.logger.info(`✅ Monitor progress on CCIP Explorer: https://ccip.chain.link/msg/${result.messageId}`);

    } catch (error) {
      this.logger.error(
        `❌ Failed to send token transfer: ${error instanceof Error ? error.message : String(error)}`
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
const command = new TokenTransferCommand();
command.run().catch((error) => {
  process.exit(1);
});
