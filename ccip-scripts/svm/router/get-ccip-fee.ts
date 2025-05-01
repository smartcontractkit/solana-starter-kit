/**
 * Solana CCIP Fee Calculation Utility
 *
 * This script demonstrates how to estimate fees for CCIP cross-chain transactions
 * without actually sending any messages or tokens.
 *
 * INSTRUCTIONS:
 * 1. Run the script with: npm run ccip:fee
 *
 * You can override settings with command line arguments:
 * --fee-token       : Token to use for fees (native, wrapped-native, link, or address)
 * --keypair         : Path to your keypair file
 * --log-level       : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight  : Skip transaction preflight checks
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

// Import AbiCoder from ethers for encoding message data
import { AbiCoder } from "ethers";

// Import from SDK for model types
import {
  CCIPFeeRequest,
  AddressConversion,
  LogLevel,
  createLogger,
} from "../../../ccip-lib/svm";

// Import from centralized config
import {
  ChainId,
  CHAIN_SELECTORS,
  getCCIPSVMConfig,
  FeeTokenType as ConfigFeeTokenType,
} from "../../config";

// Import helper utilities
import {
  printUsage,
  parseCCIPSendArgs,
  getKeypairPath,
  CCIPMessageConfig,
} from "../utils";
import { createCCIPClient } from "../utils/client-factory";

// =================================================================
// FEE CALCULATION CONFIGURATION
// Parameters to use when estimating CCIP fees
// =================================================================
const FEE_CALCULATION_CONFIG: CCIPMessageConfig = {
  // Destination configuration
  destinationChain: ChainId.ETHEREUM_SEPOLIA,
  destinationChainSelector:
    CHAIN_SELECTORS[ChainId.ETHEREUM_SEPOLIA].toString(),
  evmReceiverAddress: "0x9d087fC03ae39b088326b67fA3C788236645b717",

  // Token transfers configuration - supports multiple tokens
  tokenAmounts: [
    {
      tokenMint: getCCIPSVMConfig(ChainId.SOLANA_DEVNET).bnmTokenMint, // BnM token on Solana Devnet
      amount: "10000000", // String representation of raw token amount (0.01 with 9 decimals)
    },
  ],

  // Fee configuration
  feeToken: ConfigFeeTokenType.NATIVE, // Use SOL for fees

  // Message data - ABI-encode a string "Hello World" for EVM compatibility
  messageData: AbiCoder.defaultAbiCoder().encode(["string"], ["Hello World"]),

  // Extra arguments configuration
  extraArgs: {
    gasLimit: 200000, // Set gas limit for message execution on destination chain
    allowOutOfOrderExecution: true, // Allow out-of-order execution
  },
};

// =================================================================

/**
 * Main fee calculation function
 */
async function getFeeEstimation(): Promise<void> {
  // Parse command line arguments
  const cmdOptions = parseCCIPSendArgs();

  // Create logger with appropriate level
  const logger = createLogger("ccip-fee", {
    level: cmdOptions.logLevel ?? LogLevel.INFO,
  });

  try {
    // Get configuration
    const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

    // Display environment information
    logger.info("\n==== Environment Information ====");
    logger.info(`Solana Cluster: devnet`);

    // Get keypair path
    const keypairPath = getKeypairPath(cmdOptions);

    // Create the CCIPClient with our factory
    const ccipClient = createCCIPClient({
      keypairPath,
      logLevel: cmdOptions.logLevel,
      skipPreflight: cmdOptions.skipPreflight,
    });

    // Display CCIP Router information
    logger.info("\n==== CCIP Router Information ====");
    logger.info(`CCIP Router Program ID: ${config.routerProgramId.toString()}`);
    logger.info(
      `Fee Quoter Program ID: ${config.feeQuoterProgramId.toString()}`
    );
    logger.info(
      `RMN Remote Program ID: ${config.rmnRemoteProgramId.toString()}`
    );

    // Display fee calculation parameters
    logger.info("\n==== Fee Calculation Parameters ====");
    logger.info(
      `Destination Chain: ${FEE_CALCULATION_CONFIG.destinationChain}`
    );
    logger.info(
      `Destination Chain Selector: ${FEE_CALCULATION_CONFIG.destinationChainSelector}`
    );
    logger.info(
      `EVM Receiver Address: ${FEE_CALCULATION_CONFIG.evmReceiverAddress}`
    );
    logger.info(
      `Token Amounts: ${FEE_CALCULATION_CONFIG.tokenAmounts
        .map((t) => `${t.amount} (${t.tokenMint.toString()})`)
        .join(", ")}`
    );
    logger.info(`Fee Token: ${FEE_CALCULATION_CONFIG.feeToken}`);
    logger.info(
      `Message Data Length: ${
        Buffer.from(FEE_CALCULATION_CONFIG.messageData || "").length
      } bytes`
    );
    logger.info(`Gas Limit: ${FEE_CALCULATION_CONFIG.extraArgs.gasLimit}`);
    logger.info(
      `Allow Out Of Order Execution: ${FEE_CALCULATION_CONFIG.extraArgs.allowOutOfOrderExecution}`
    );

    // Convert the EVM address to the format expected by Solana
    const receiverBytes = AddressConversion.evmAddressToSolanaBytes(
      FEE_CALCULATION_CONFIG.evmReceiverAddress
    );

    // Convert amounts to BN values
    const tokenAmounts = FEE_CALCULATION_CONFIG.tokenAmounts.map((t) => ({
      token: new PublicKey(t.tokenMint),
      amount: new anchor.BN(t.amount),
    }));

    // Determine fee token
    let feeToken: PublicKey;
    if (FEE_CALCULATION_CONFIG.feeToken === ConfigFeeTokenType.NATIVE) {
      feeToken = PublicKey.default;
      logger.info("Using native SOL as fee token");
    } else if (
      FEE_CALCULATION_CONFIG.feeToken === ConfigFeeTokenType.WRAPPED_NATIVE
    ) {
      feeToken = new PublicKey(NATIVE_MINT);
      logger.info(`Using wrapped SOL as fee token: ${NATIVE_MINT.toString()}`);
    } else if (FEE_CALCULATION_CONFIG.feeToken === ConfigFeeTokenType.LINK) {
      feeToken = new PublicKey(config.linkTokenMint);
      logger.info(
        `Using LINK token as fee token: ${config.linkTokenMint.toString()}`
      );
    } else {
      // Try to parse it as a custom address
      try {
        feeToken = new PublicKey(FEE_CALCULATION_CONFIG.feeToken);
        logger.info(`Using custom fee token address: ${feeToken.toString()}`);
      } catch (error) {
        logger.warn(
          `Invalid fee token: ${FEE_CALCULATION_CONFIG.feeToken}, using default native SOL`
        );
        feeToken = PublicKey.default;
      }
    }

    // Default extraArgs values
    const DEFAULT_GAS_LIMIT = 200000;
    const DEFAULT_ALLOW_OUT_OF_ORDER = true;

    // Generate extra args buffer - ALWAYS create it with appropriate values
    const extraArgsConfig = {
      gasLimit: FEE_CALCULATION_CONFIG.extraArgs?.gasLimit || DEFAULT_GAS_LIMIT,
      allowOutOfOrderExecution: 
        FEE_CALCULATION_CONFIG.extraArgs?.allowOutOfOrderExecution !== undefined 
          ? FEE_CALCULATION_CONFIG.extraArgs.allowOutOfOrderExecution 
          : DEFAULT_ALLOW_OUT_OF_ORDER,
    };

    // Log warning if using default values
    if (!FEE_CALCULATION_CONFIG.extraArgs?.gasLimit) {
      logger.warn(`No gasLimit provided in extraArgs, using default value: ${DEFAULT_GAS_LIMIT}`);
    }
    if (FEE_CALCULATION_CONFIG.extraArgs?.allowOutOfOrderExecution === undefined) {
      logger.warn(`No allowOutOfOrderExecution flag provided in extraArgs, using default value: ${DEFAULT_ALLOW_OUT_OF_ORDER}`);
    }

    // Force allowOutOfOrderExecution to true to avoid error 8030
    if (!extraArgsConfig.allowOutOfOrderExecution) {
      logger.warn("Setting allowOutOfOrderExecution to true to avoid FeeQuoter error 8030");
      extraArgsConfig.allowOutOfOrderExecution = true;
    }

    const extraArgs = ccipClient.createExtraArgs(extraArgsConfig);

    // Log the extraArgs buffer for debugging
    logger.debug(`ExtraArgs buffer (hex): ${extraArgs.toString('hex')}`);

    // Create the CCIPFeeRequest
    const feeRequest: CCIPFeeRequest = {
      destChainSelector: new anchor.BN(
        FEE_CALCULATION_CONFIG.destinationChainSelector
      ),
      message: {
        receiver: receiverBytes,
        data: Buffer.from(FEE_CALCULATION_CONFIG.messageData || ""),
        tokenAmounts: tokenAmounts,
        feeToken: feeToken,
        extraArgs: extraArgs,
      },
    };

    logger.info("\n==== Fee Request Details ====");
    logger.debug(
      `Destination Chain Selector: ${feeRequest.destChainSelector.toString()}`
    );
    logger.debug(
      `Receiver (bytes): ${Buffer.from(receiverBytes).toString("hex")}`
    );
    logger.debug(
      `Token Amounts: ${tokenAmounts
        .map((ta) => `${ta.amount.toString()} (${ta.token.toString()})`)
        .join(", ")}`
    );
    logger.debug(`Fee Token: ${feeToken.toString()}`);

    logger.info("\n==== Calculating Fee ====");
    logger.info("Preparing fee request...");

    // Calculate fee
    const feeResult = await ccipClient.getFee(feeRequest);

    logger.info("\n==== Fee Calculation Results ====");

    // Format fee amount based on token type
    const feeTokenResult = new PublicKey(feeResult.token);
    let formattedFee: string;

    if (feeTokenResult.equals(NATIVE_MINT)) {
      formattedFee = `${feeResult.amount.toNumber() / LAMPORTS_PER_SOL} SOL`;
      logger.info("Fee is calculated in SOL");
    } else {
      formattedFee = `${feeResult.amount.toString()} (Token: ${feeTokenResult.toString()})`;
      logger.info("Fee is calculated in a token other than native SOL");
    }

    logger.info(`Estimated Fee: ${formattedFee}`);
    logger.info(`Fee in Juels: ${feeResult.juels.toString()}`);
    logger.info(`Fee Token: ${feeTokenResult.toString()}`);

    // Add additional information for advanced users
    logger.debug("\n==== Additional Fee Details ====");
    logger.debug(
      `Fee token equals PublicKey.default: ${feeTokenResult.equals(
        PublicKey.default
      )}`
    );
    logger.debug(
      `Fee token equals NATIVE_MINT: ${feeTokenResult.equals(NATIVE_MINT)}`
    );
    logger.debug(`PublicKey.default value: ${PublicKey.default.toString()}`);
    logger.debug(`NATIVE_MINT value: ${NATIVE_MINT.toString()}`);
  } catch (error) {
    logger.error(
      `\n❌ Failed to calculate CCIP fee: ${
        error instanceof Error ? error.message : String(error)
      }`
    );

    if (error instanceof Error && error.stack) {
      logger.debug("\nError stack:");
      logger.debug(error.stack);

      // Check for context in enhanced errors from SDK
      if ((error as any).context) {
        logger.error("\nError Context:");
        logger.error(JSON.stringify((error as any).context, null, 2));
      }
    }
    printUsage("ccip:fee");
    process.exit(1);
  }
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("ccip:fee");
  process.exit(0);
}

// Run the script
getFeeEstimation().catch((err) => {
  console.error(`Unhandled error in fee estimation: ${err}`);
  process.exit(1);
});
