import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  CCIPSendRequest,
  CCIPSendOptions,
  ExtraArgsOptions,
  LogLevel,
  AddressConversion,
  createLogger,
  Logger,
} from "../../../../ccip-lib/svm";
import {
  ChainId,
  getCCIPSVMConfig,
  FeeTokenType as ConfigFeeTokenType,
} from "../../../config";
import {
  loadKeypair,
  getKeypairPath,
  printUsage,
} from "../../utils";
import { toOnChainAmount } from "../../../../ccip-lib/svm";
import { createCCIPClient } from "../../utils/client-factory";
import { validateSolBalance, validateTokenBalances } from "./validation";
import { ExecutorOptions, CCIPOptions } from "./config-types";

/**
 * Core executor function for CCIP scripts
 * This function handles the common workflow across all CCIP scripts
 * while allowing for script-specific configurations
 *
 * @param options Executor options including script-specific configurations
 */
export async function executeCCIPScript({
  scriptName,
  usageName,
  messageConfig,
  scriptConfig,
  cmdOptions,
}: ExecutorOptions): Promise<void> {
  // Create logger with appropriate level
  const logger = createLogger(scriptName, {
    level: cmdOptions.logLevel ?? LogLevel.INFO,
  });

  try {
    // STEP 1: Parse command line arguments handled by the caller
    logger.info("\n==== Environment Information ====");
    logger.info(`Solana Cluster: devnet`);

    const keypairPath = getKeypairPath(cmdOptions);
    logger.info(`Keypair Path: ${keypairPath}`);
    logger.info(`Log Level: ${LogLevel[cmdOptions.logLevel ?? LogLevel.INFO]}`);
    logger.info(`Skip Preflight: ${cmdOptions.skipPreflight ? "Yes" : "No"}`);

    // STEP 2: Combine hardcoded config with any command line overrides
    const options = {
      // Start with hardcoded values
      tokenAmounts: messageConfig.tokenAmounts,
      destinationChain: messageConfig.destinationChain,
      destinationChainSelector: messageConfig.destinationChainSelector,
      evmReceiverAddress: messageConfig.evmReceiverAddress,
      feeToken: messageConfig.feeToken,
      extraArgs: messageConfig.extraArgs,
      computeUnits: scriptConfig.computeUnits,
      minSolRequired: scriptConfig.minSolRequired,
      messageData: messageConfig.messageData,
      logLevel: cmdOptions.logLevel,

      // Command line arguments override hardcoded config
      ...cmdOptions,
    };

    // STEP 2.1: Handle partial token override cases
    // If user provided --token-mint but no --token-amount, and no tokenAmounts array was created,
    // then create a tokenAmounts array using the custom mint with the default amount
    if (cmdOptions.tokenMint && !cmdOptions.tokenAmounts) {
      logger.debug(`Detected partial token override: custom mint with default amount`);
      logger.debug(`Custom token mint: ${cmdOptions.tokenMint}`);
      
      // Use the amount from the default configuration (first token) or the provided amount
      const defaultAmount = cmdOptions.tokenAmount || 
        (messageConfig.tokenAmounts.length > 0 ? messageConfig.tokenAmounts[0].amount : "0");
      
      logger.debug(`Using amount: ${defaultAmount} (${cmdOptions.tokenAmount ? 'custom' : 'default'})`);
      
      // Create the tokenAmounts array with the custom mint
      options.tokenAmounts = [
        {
          tokenMint: cmdOptions.tokenMint,
          amount: defaultAmount,
        },
      ];
      
      logger.debug(`Created tokenAmounts array for partial override`);
    }

    // STEP 3: Set up client
    // Load wallet keypair
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Create the CCIPClient with our factory
    const ccipClient = createCCIPClient({
      keypairPath,
      logLevel: options.logLevel,
    });

    // Get configuration
    const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

    // STEP 4: Check wallet balance
    logger.info("\n==== Wallet Balance Information ====");
    const connection = config.connection;
    const balance = await connection.getBalance(walletKeypair.publicKey);
    logger.info(`SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    logger.info(`Lamports Balance: ${balance} lamports`);

    logger.info("\n==== CCIP Router Information ====");
    logger.info(`CCIP Router Program ID: ${config.routerProgramId.toString()}`);
    logger.info(
      `Fee Quoter Program ID: ${config.feeQuoterProgramId.toString()}`
    );
    logger.info(
      `RMN Remote Program ID: ${config.rmnRemoteProgramId.toString()}`
    );

    // STEP 5: Display token transfer configuration
    logger.info("\n==== CCIP Send Configuration ====");
    logger.info(
      `Destination Chain Selector: ${options.destinationChainSelector.toString()}`
    );
    logger.info(`Receiver Address: ${options.evmReceiverAddress}`);

    // Display information for each token being transferred
    logger.info("\n==== Token Transfer Details ====");
    for (let i = 0; i < options.tokenAmounts.length; i++) {
      const tokenTransfer = options.tokenAmounts[i];
      const tokenMint = new PublicKey(tokenTransfer.tokenMint);
      const tokenAmount = tokenTransfer.amount.toString();

      // Determine token program and get decimals
      const tokenProgramId = await detectTokenProgram(
        tokenMint,
        connection,
        logger
      );

      const tokenDecimals = await fetchTokenDecimals(
        connection,
        tokenMint,
        tokenProgramId,
        logger
      );

      // Format token amount for display
      const humanReadableAmount = formatTokenAmount(tokenAmount, tokenDecimals);
      logger.info(`Token ${i + 1}: ${tokenMint.toString()}`);
      logger.info(
        `Amount ${
          i + 1
        }: ${tokenAmount} raw units (${humanReadableAmount} tokens with ${tokenDecimals} decimals)`
      );
    }

    logger.info(`Fee Token: ${options.feeToken}`);

    // STEP 6: Set up fee token based on configuration
    logger.info("\n==== Fee Token Configuration ====");
    let FEE_TOKEN: PublicKey;
    if (options.feeToken) {
      const tokenOption =
        typeof options.feeToken === "string"
          ? options.feeToken.toLowerCase()
          : options.feeToken;

      // Use the appropriate config value based on the token type
      switch (tokenOption) {
        case ConfigFeeTokenType.NATIVE:
          FEE_TOKEN = PublicKey.default;
          logger.info("Using native SOL as fee token");
          break;

        case ConfigFeeTokenType.WRAPPED_NATIVE:
          FEE_TOKEN = new PublicKey(NATIVE_MINT);
          logger.info(
            `Using wrapped SOL as fee token: ${NATIVE_MINT.toString()}`
          );
          break;

        case ConfigFeeTokenType.LINK:
          FEE_TOKEN = new PublicKey(config.linkTokenMint);
          logger.info(
            `Using LINK token as fee token: ${config.linkTokenMint.toString()}`
          );
          break;

        default:
          // Try to parse it as a custom address
          try {
            FEE_TOKEN = new PublicKey(options.feeToken);
            logger.info(
              `Using custom fee token address: ${FEE_TOKEN.toString()}`
            );
          } catch (error) {
            logger.warn(
              `Invalid fee token: ${options.feeToken}, using default native SOL`
            );
            FEE_TOKEN = PublicKey.default;
          }
      }
    } else {
      // Default to native SOL
      FEE_TOKEN = PublicKey.default;
      logger.info("Using default fee token: native SOL");
    }

    // STEP 7: Create extraArgs configuration
    const defaultGasLimit = scriptConfig.defaultExtraArgs?.gasLimit ?? 200000;
    const defaultAllowOutOfOrder =
      scriptConfig.defaultExtraArgs?.allowOutOfOrderExecution ?? true;

    const extraArgsConfig: ExtraArgsOptions = {
      gasLimit: options.extraArgs?.gasLimit ?? defaultGasLimit,
      allowOutOfOrderExecution:
        options.extraArgs?.allowOutOfOrderExecution !== undefined
          ? options.extraArgs.allowOutOfOrderExecution
          : defaultAllowOutOfOrder,
    };

    // Log warning if using default values
    if (!options.extraArgs?.gasLimit) {
      logger.warn(
        `No gasLimit provided in extraArgs, using default value: ${defaultGasLimit}`
      );
    }
    if (options.extraArgs?.allowOutOfOrderExecution === undefined) {
      logger.warn(
        `No allowOutOfOrderExecution flag provided in extraArgs, using default value: ${defaultAllowOutOfOrder}`
      );
    }

    // Force allowOutOfOrderExecution to true to avoid error 8030
    if (!extraArgsConfig.allowOutOfOrderExecution) {
      logger.warn(
        "Setting allowOutOfOrderExecution to true to avoid FeeQuoter error 8030"
      );
      extraArgsConfig.allowOutOfOrderExecution = true;
    }

    // Generate the extraArgs buffer
    const extraArgs = ccipClient.createExtraArgs(extraArgsConfig);

    // Log the extraArgs buffer for debugging
    logger.debug(`ExtraArgs buffer (hex): ${extraArgs.toString("hex")}`);

    // STEP 8: Process message data
    const messageDataBuffer = messageDataToBuffer(options.messageData);

    // Log message data if present
    if (messageDataBuffer.length > 0) {
      logger.info(`Message Data: ${options.messageData}`);
      // Try to show as text if possible
      try {
        const textData = messageDataBuffer.toString("utf8");
        if (/^[\x20-\x7E]*$/.test(textData)) {
          // Check if ASCII printable
          logger.info(`Message Data (as text): ${textData}`);
        }
      } catch (e) {
        // Ignore decoding errors
      }
    }

    // STEP 9: Prepare CCIP message
    // Convert the EVM address to the format expected by Solana
    const receiverBytes = AddressConversion.evmAddressToSolanaBytes(
      options.evmReceiverAddress
    );

    // Map token transfers to the format expected by CCIP
    const tokenTransfers = options.tokenAmounts.map((tokenTransfer) => ({
      token: new PublicKey(tokenTransfer.tokenMint),
      amount: toOnChainAmount(tokenTransfer.amount.toString()),
    }));

    // STEP 10: Create the CCIP Send Request
    const sendRequest: CCIPSendRequest = {
      destChainSelector: new anchor.BN(
        options.destinationChainSelector.toString()
      ),
      receiver: receiverBytes,
      data: messageDataBuffer, // Use the processed message data from config
      tokenAmounts: tokenTransfers,
      feeToken: FEE_TOKEN,
      extraArgs: extraArgs,
    };

    logger.info("\n==== CCIP Message Request Created ====");
    logger.debug("Request details:", {
      destChainSelector: sendRequest.destChainSelector.toString(),
      tokenAmounts: options.tokenAmounts.map(
        (t, i) => `${i + 1}: ${t.tokenMint.toString()} - ${t.amount.toString()}`
      ),
      feeToken: FEE_TOKEN.toString(),
    });

    // STEP 11: Add compute budget instruction for Solana transaction
    logger.info("\n==== Compute Budget Configuration ====");
    const additionalComputeBudget = ComputeBudgetProgram.setComputeUnitLimit({
      units: options.computeUnits, // Maximum compute units
    });
    logger.info(
      `Added compute budget instruction with limit: ${options.computeUnits} units`
    );

    // STEP 12: Calculate fee for the transaction
    logger.info("\n==== Fee Calculation ====");
    const feeRequest = {
      destChainSelector: sendRequest.destChainSelector,
      message: {
        receiver: sendRequest.receiver,
        data: sendRequest.data,
        tokenAmounts: sendRequest.tokenAmounts,
        feeToken: sendRequest.feeToken,
        extraArgs: extraArgs,
      },
    };

    logger.info("Calculating fee for this transaction...");
    const feeResult = await ccipClient.getFee(feeRequest);

    // Format fee amount based on token type
    let formattedFee: string;
    const feeTokenResult = new PublicKey(feeResult.token);

    if (feeTokenResult.equals(NATIVE_MINT)) {
      formattedFee = `${feeResult.amount.toNumber() / LAMPORTS_PER_SOL} SOL`;
    } else {
      formattedFee = `${feeResult.amount.toString()} (Token: ${feeTokenResult.toString()})`;
    }

    logger.info(`Estimated fee: ${formattedFee}`);
    logger.info(`Fee in Juels: ${feeResult.juels.toString()}`);

    // STEP 13: Validate balances before proceeding
    logger.info("\n==== Balance Validation ====");

    // Validate SOL balance
    await validateSolBalance(
      connection,
      walletKeypair.publicKey,
      options.minSolRequired,
      logger
    );

    // Validate token balances
    await validateTokenBalances(
      connection,
      walletKeypair.publicKey,
      options.tokenAmounts,
      logger
    );

    // STEP 14: Send the CCIP message
    logger.info("\n==== Sending CCIP Message ====");
    logger.info("⏳ This may take a minute...");

    // Create send options if skipPreflight is enabled
    const sendOptions: CCIPSendOptions | undefined = options.skipPreflight
      ? { skipPreflight: true }
      : undefined;

    logger.info(
      `Transaction options: ${
        sendOptions ? "skipPreflight=true" : "default settings"
      }`
    );

    if (options.skipPreflight) {
      logger.warn(
        "⚠️  SKIPPING PREFLIGHT - Transaction will be forced to network even if it might fail"
      );
    }

    // Use the client to send the message
    const result = await ccipClient.sendWithMessageId(
      sendRequest,
      additionalComputeBudget,
      sendOptions
    );

    // STEP 15: Display transfer results
    logger.info("\n==== CCIP Message Sent Successfully ====");
    logger.info(`Transaction signature: ${result.txSignature}`);

    if (result.messageId) {
      logger.info(`Message ID: ${result.messageId}`);
      logger.info(`👉 CCIP Explorer: ${getCCIPExplorerUrl(result.messageId)}`);
    } else {
      logger.warn("Message ID not available in transaction logs.");
    }

    logger.info("\nView transaction on explorer:");
    logger.info(
      `https://explorer.solana.com/tx/${result.txSignature}?cluster=devnet`
    );
  } catch (error) {
    // Improved error message formatting
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === "object") {
      try {
        errorMessage = JSON.stringify(error, null, 2);
      } catch {
        errorMessage = String(error);
      }
    } else {
      errorMessage = String(error);
    }

    logger.error(`\n❌ Failed to send CCIP message: ${errorMessage}`);

    if (error instanceof Error && error.stack) {
      logger.debug("\nError stack:");
      logger.debug(error.stack);

      // Check for context in enhanced errors from SDK
      if ((error as any).context) {
        logger.error("\nError Context:");
        logger.error(JSON.stringify((error as any).context, null, 2));
      }
    }

    printUsage(usageName);
    process.exit(1);
  }
}

// Import these after function to avoid circular dependencies
import {
  detectTokenProgram,
  fetchTokenDecimals,
  formatTokenAmount,
} from "../../../../ccip-lib/svm";
import { messageDataToBuffer } from "../token-utils";
import { getCCIPExplorerUrl } from "../../../evm/utils";
