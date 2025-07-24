/**
 * EVM to Solana CCIP Combined Data and Token Transfer (CLI Framework Version)
 *
 * This script demonstrates how to send both tokens and arbitrary data in a single message
 * from Ethereum to Solana using Chainlink CCIP (Cross-Chain Interoperability Protocol).
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
import { FeeTokenType, getEVMConfig, getCCIPSVMConfig, ChainId } from "../../config";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { detectTokenProgram } from "../../../ccip-lib/svm";

/**
 * Utility function to derive PDAs for CCIP Receiver accounts
 * 
 * @param receiverProgramId - The CCIP Receiver program ID
 * @returns Object containing the derived PDAs
 */
function deriveReceiverPDAs(receiverProgramIdStr: string) {
  // Convert string to PublicKey
  const receiverProgramId = new PublicKey(receiverProgramIdStr);
  
  // Seeds for PDAs (these match the ones in the Rust program)
  const STATE_SEED = Buffer.from("state");
  const MESSAGES_STORAGE_SEED = Buffer.from("messages_storage");
  const TOKEN_ADMIN_SEED = Buffer.from("token_admin");
  
  // Derive the state PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [STATE_SEED],
    receiverProgramId
  );
  
  // Derive the messages storage PDA
  const [messagesStoragePda] = PublicKey.findProgramAddressSync(
    [MESSAGES_STORAGE_SEED],
    receiverProgramId
  );
  
  // Derive token admin PDA (authority for token accounts)
  const [tokenAdminPda] = PublicKey.findProgramAddressSync(
    [TOKEN_ADMIN_SEED],
    receiverProgramId
  );
  
  return {
    state: statePda,
    messagesStorage: messagesStoragePda,
    tokenAdmin: tokenAdminPda,
  };
}

/**
 * Options specific to the data and tokens command
 */
interface DataAndTokensOptions extends BaseCommandOptions {
  // Combined transfer specific options
  sourceChain?: ChainId;
  messageData?: string;
  defaultReceiver?: string;
  defaultTokenReceiver?: string;
  defaultComputeUnits?: number;
}

/**
 * Data and Tokens Transfer Command Implementation
 */
class DataAndTokensCommand extends CCIPCommand<DataAndTokensOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "data-and-tokens",
      description:
        "🔄 EVM to Solana CCIP Data and Token Transfer\n\nSend both tokens and custom messages in a single transaction from EVM chains (Ethereum, Avalanche) to Solana using Chainlink CCIP. Perfect for complex cross-chain operations.",
      examples: [
        "# Send BnM token with default message",
        "yarn evm:data-and-tokens",
        "",
        "# Send custom token amount with message",
        'yarn evm:data-and-tokens --amount 50000000000000000 --data "Custom transfer message"',
        "",
        "# Send multiple tokens with data",
        'yarn evm:data-and-tokens --token-amounts "0x779...789:1000000000000000000,0xFd5...05:2000000000000000000" --data "Multi-token transfer"',
        "",
        "# Use hex-encoded message data",
        "yarn evm:data-and-tokens --data 0x48656c6c6f2c20536f6c616e6121 --compute-units 200000",
        "",
        "# Custom receivers for both message and tokens",
        'yarn evm:data-and-tokens --receiver 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --token-receiver EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB --data "Custom receivers"',
      ],
      notes: [
        "Requires EVM_PRIVATE_KEY in environment variables",
        "Default source chain is Ethereum Sepolia",
        "Combines token transfer with message data in single transaction",
        "Message data can be plain text or hex (with 0x prefix)",
        "Receiver address is for message delivery; token-receiver is where tokens arrive",
        "Higher compute units needed for complex message processing",
        "Supports both single and multi-token transfers with data",
        "More cost-effective than separate token and message transactions",
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
        name: "data",
        aliases: ["d", "message"],
        type: "string",
        description: "Message data to send (text or hex with 0x prefix)",
        defaultValue: "Hello World",
        example: "Custom transfer message",
      },
      {
        name: "receiver",
        aliases: ["r"],
        type: "string",
        description: "Solana receiver address for the message",
        example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
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
        name: "compute-units",
        aliases: ["cu"],
        type: "number",
        description: "Solana compute units for execution (higher needed for data+tokens)",
        defaultValue: 200000,
        example: "300000",
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

  /**
   * Get default receiver for message delivery
   */
  private getDefaultReceiver(): string {
    // For data and tokens, use the CCIP receiver program ID
    const solanaConfig = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
    return solanaConfig.receiverProgramId.toString();
  }

  protected async execute(): Promise<void> {
    this.logger.info("🔄 EVM to Solana CCIP Data and Token Transfer");
    this.logger.info("=========================================");

    try {
      // Prepare transfer configuration
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

      // Prepare message data
      const messageData = this.options.messageData || this.options.data || "Hello World";
      
      // Convert text to hex if not already hex
      const hexData = messageData.startsWith("0x") 
        ? messageData 
        : "0x" + Buffer.from(messageData).toString("hex");

      this.logger.info(`Source Chain: ${sourceChain}`);
      this.logger.info(`Token Amounts: ${tokenAmounts.length} token(s)`);
      this.logger.info(`Message Data: "${messageData}"`);
      this.logger.info(`Hex Encoded: ${hexData}`);

      // Get Solana configuration for PDA derivation and token operations
      const solanaConfig = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
      const recipientWalletAddress = new PublicKey(
        this.options.tokenReceiver || "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB"
      );

      // Derive PDAs for the CCIP receiver program
      const receiverProgramId = solanaConfig.receiverProgramId.toString();
      const pdas = deriveReceiverPDAs(receiverProgramId);

      // Get token mint and derive associated token accounts
      const mintPubkey = new PublicKey(solanaConfig.bnmTokenMint);
      const connection = solanaConfig.connection;

      // Determine the token program ID for the mint
      const tokenProgramId = await detectTokenProgram(
        mintPubkey,
        connection,
        this.logger
      );

      // Derive Associated Token Accounts
      const recipientATA = getAssociatedTokenAddressSync(
        mintPubkey,
        recipientWalletAddress,
        false, // allowOwnerOffCurve = false for regular wallet addresses
        tokenProgramId
      );

      const tokenAdminATA = getAssociatedTokenAddressSync(
        mintPubkey,
        pdas.tokenAdmin,
        true, // allowOwnerOffCurve = true since PDAs are off-curve
        tokenProgramId
      );

      // Prepare transfer options for utility functions
      const transferOptions = {
        // Token configuration
        tokenAmounts,
        
        // Fee configuration
        feeToken: this.options.feeToken || FeeTokenType.LINK,
        
        // Message and receiver configuration
        data: hexData,
        receiver: this.options.receiver || this.getDefaultReceiver(),
        
        // Token receiver is the token_admin PDA (where CCIP initially deposits tokens)
        tokenReceiver: pdas.tokenAdmin.toString(),
        
        // Solana execution configuration
        // Higher compute units needed because combined message and token processing requires more compute
        computeUnits: this.options.computeUnits || 200000,
        allowOutOfOrderExecution: true,
        
        // ACCOUNT WRITABLE BITMAP EXPLANATION FOR DATA + TOKENS:
        // The accounts array contains PDAs and token accounts needed for both message and token processing.
        // Each account can be either read-only or writable:
        //
        // Account List (in order):
        // Position 0: state PDA                - READ-ONLY  (stores program configuration)
        // Position 1: messagesStorage PDA      - WRITABLE   (stores incoming CCIP messages)
        // Position 2: token_mint               - WRITABLE   (token mint account)
        // Position 3: source_token_account     - WRITABLE   (where CCIP deposits tokens initially)
        // Position 4: token_admin PDA          - READ-ONLY  (authority for token operations)
        // Position 5: recipient_token_account  - WRITABLE   (final destination for tokens)
        // Position 6: token_program            - READ-ONLY  (token program for operations)
        //
        // Bitmap Calculation:
        // - Each bit position corresponds to an account position in the array
        // - Bit = 0 means READ-ONLY, Bit = 1 means WRITABLE
        // - Position 0 (state): bit 0 = 0 (read-only)
        // - Position 1 (messagesStorage): bit 1 = 1 (writable)
        // - Position 2 (token_mint): bit 2 = 1 (writable)
        // - Position 3 (source_token_account): bit 3 = 1 (writable)
        // - Position 4 (token_admin): bit 4 = 0 (read-only)
        // - Position 5 (recipient_token_account): bit 5 = 1 (writable)
        // - Position 6 (token_program): bit 6 = 0 (read-only)
        // - Binary: 0101110 (reading right to left: bit0=0, bit1=1, bit2=1, bit3=1, bit4=0, bit5=1, bit6=0)
        // - Decimal: 46 (binary 0101110 = decimal 46)
        accountIsWritableBitmap: BigInt(46),
        
        // Accounts array - All accounts needed for combined message and token processing
        accounts: [
          pdas.state.toString(),                    // Position 0: READ-ONLY  (bit 0 = 0)
          pdas.messagesStorage.toString(),          // Position 1: WRITABLE   (bit 1 = 1)
          solanaConfig.bnmTokenMint.toString(),     // Position 2: WRITABLE   (bit 2 = 1)
          tokenAdminATA.toString(),                 // Position 3: WRITABLE   (bit 3 = 1)
          pdas.tokenAdmin.toString(),               // Position 4: READ-ONLY  (bit 4 = 0)
          recipientATA.toString(),                  // Position 5: WRITABLE   (bit 5 = 1)
          tokenProgramId.toString(),                // Position 6: READ-ONLY  (bit 6 = 0)
        ],
        
        // Chain configuration
        chainId: sourceChain,
        
        // Logging and authentication
        logLevel: this.options.logLevel,
        privateKey: this.options.privateKey,
      };

      this.logger.info(`Fee Token: ${transferOptions.feeToken}`);
      this.logger.info(`Message Receiver: ${transferOptions.receiver}`);
      this.logger.info(`Token Receiver: ${transferOptions.tokenReceiver}`);
      this.logger.info(`Compute Units: ${transferOptions.computeUnits}`);
      
      // Log detailed Solana configuration before encoding
      this.logger.info("\n📋 Solana Configuration (Data + Tokens)");
      this.logger.info("=========================================");
      this.logger.info(`Allow Out-of-Order Execution: ${transferOptions.allowOutOfOrderExecution}`);
      this.logger.info(`Account Writable Bitmap: ${transferOptions.accountIsWritableBitmap} (binary: ${transferOptions.accountIsWritableBitmap.toString(2)})`);
      
      if (transferOptions.accounts && transferOptions.accounts.length > 0) {
        this.logger.info(`Solana Accounts (${transferOptions.accounts.length}):`);
        transferOptions.accounts.forEach((account, index) => {
          const isWritable = (transferOptions.accountIsWritableBitmap & (BigInt(1) << BigInt(index))) !== BigInt(0);
          const accountType = [
            'state PDA',
            'messagesStorage PDA', 
            'token_mint',
            'source_token_account (tokenAdmin ATA)',
            'token_admin PDA',
            'recipient_token_account (recipient ATA)',
            'token_program'
          ][index] || 'unknown';
          this.logger.info(`  ${index}: ${account} (${isWritable ? 'WRITABLE' : 'read-only'}) - ${accountType}`);
        });
      } else {
        this.logger.info("No additional Solana accounts specified");
      }
      
      // Log derived addresses for clarity
      this.logger.debug(`\nDerived Addresses:`);
      this.logger.debug(`State PDA: ${pdas.state.toString()}`);
      this.logger.debug(`Messages Storage PDA: ${pdas.messagesStorage.toString()}`);
      this.logger.debug(`Token Admin PDA: ${pdas.tokenAdmin.toString()}`);
      this.logger.debug(`Token Admin ATA: ${tokenAdminATA.toString()}`);
      this.logger.debug(`Recipient ATA: ${recipientATA.toString()}`);
      this.logger.debug(`Token Program: ${tokenProgramId.toString()}`);

      // Set up client context
      const context = await setupClientContext(transferOptions, "data-and-tokens");
      
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

      this.logger.info("\n🚀 Executing Combined Transfer");
      this.logger.info("=========================================");
      this.logger.info("Sending CCIP message with tokens and data...");

      // Execute the combined transfer
      const result = await client.sendCCIPMessage(messageRequest);

      this.logger.info("\n🎉 Transfer Results");
      this.logger.info("=========================================");

      // Display results
      displayTransferResults(result, config, this.logger);

      this.logger.info("\n✅ Combined Transfer Complete!");
      this.logger.info("🔗 Your tokens and message are being bridged to Solana");

    } catch (error) {
      this.logger.error(
        `❌ Combined transfer failed: ${
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
  const command = new DataAndTokensCommand();
  command.run().catch((error) => {
    process.exit(1);
  });
}

export { DataAndTokensCommand };