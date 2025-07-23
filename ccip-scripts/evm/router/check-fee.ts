/**
 * EVM CCIP Fee Estimation Script (Read-Only)
 * 
 * This script demonstrates read-only operations using CCIPMessenger without a signer.
 * It checks the estimated fee for sending a CCIP message without actually sending it.
 * 
 * INSTRUCTIONS:
 * Run the script with: yarn evm:check-fee
 * 
 * You can override settings with command line arguments:
 * --destination     : Destination chain (default: solana-devnet)
 * --token          : Token address to simulate transfer
 * --amount         : Amount of tokens to simulate
 * --log-level      : Logging verbosity (0-5)
 */

import { ethers } from "ethers";
import { createLogger, LogLevel, CCIPMessenger } from "../../../ccip-lib/evm";
import { parseCommonArgs, printUsage } from "../utils/config-parser";
import { ChainId, getEVMConfig, CHAIN_SELECTORS } from "../../config";
import { createCCIPMessageRequest, parseScriptArgs } from "../utils/message-utils";

// Create initial logger
const initialLogger = createLogger("check-fee", { level: LogLevel.INFO });

// Define default values
const DEFAULT_DESTINATION = ChainId.SOLANA_DEVNET;
const DEFAULT_AMOUNT = "1000000000000000000"; // 1 token with 18 decimals

async function checkCCIPFee(): Promise<void> {
  // Parse command line arguments (same as token transfer)
  const options = parseScriptArgs();
  
  try {
    // Check for help flag
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      printUsage("evm:check-fee");
      process.exit(0);
    }

    // Create logger
    const logger = createLogger("check-fee", {
      level: options.logLevel ?? LogLevel.INFO,
    });

    // Get source chain configuration (same as token transfer)
    const sourceChain = ChainId.ETHEREUM_SEPOLIA;
    const sourceConfig = getEVMConfig(sourceChain);
    
    logger.info("\n==== CCIP Fee Check (Read-Only) ====");
    logger.info(`Source Chain: ${sourceConfig.name}`);
    logger.info(`Router Address: ${sourceConfig.routerAddress}`);
    
    // Create a read-only provider (no private key needed)
    const provider = new ethers.JsonRpcProvider(sourceConfig.rpcUrl);
    
    // Create CCIPMessenger with read-only provider
    const context = {
      provider: { provider }, // Read-only provider
      config: {
        routerAddress: sourceConfig.routerAddress,
        tokenAdminRegistryAddress: sourceConfig.tokenAdminRegistryAddress,
      },
      logger,
    };
    
    const client = new CCIPMessenger(context);
    
    // Set up default options for token transfer simulation (same as token transfer script)
    const simulationOptions = {
      ...options,
      receiver: "11111111111111111111111111111111", // Default PublicKey for Solana
      tokenReceiver: "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB",
      tokenAmounts: [{
        token: sourceConfig.bnmTokenAddress,
        amount: "10000000000000000", // 0.01 tokens (18 decimals)
      }],
      computeUnits: 0,
      allowOutOfOrderExecution: true,
      accountIsWritableBitmap: BigInt(0),
      accounts: [],
    };
    
    logger.info("\n==== Fee Estimation Request ====");
    logger.info(`Token to Transfer: ${sourceConfig.bnmTokenAddress} (BnM)`);
    logger.info(`Amount: 0.01 BnM`);
    
    // Create the CCIP message request (exactly same as token transfer)
    const messageRequest = createCCIPMessageRequest(sourceConfig, simulationOptions, logger);
    
    // Get fee estimate (read-only operation)
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
    
    // Format the fee amount
    const formattedFee = ethers.formatUnits(feeResult.amount, 18); // LINK has 18 decimals
    
    logger.info("\n==== Fee Estimation Results ====");
    logger.info(`Estimated Fee: ${formattedFee} LINK`);
    logger.info(`Raw Fee Amount: ${feeResult.amount.toString()}`);
    logger.info(`Fee Token Address: ${feeResult.token}`);
    
    // Check current gas price
    const feeData = await provider.getFeeData();
    if (feeData.gasPrice) {
      const gasPriceGwei = ethers.formatUnits(feeData.gasPrice, "gwei");
      logger.info(`\nCurrent Gas Price: ${gasPriceGwei} gwei`);
    }
    
    logger.info("\n✅ Fee check completed successfully (read-only operation)");
    
  } catch (error) {
    initialLogger.error("\n❌ Error checking CCIP fee:");
    if (error instanceof Error) {
      initialLogger.error(error.message);
      if (error.stack && options.logLevel === LogLevel.DEBUG) {
        initialLogger.error(error.stack);
      }
    } else {
      initialLogger.error(String(error));
    }
    
    printUsage("evm:check-fee");
    process.exit(1);
  }
}

// Run the script
checkCCIPFee().catch((error) => {
  const fallbackLogger = createLogger("check-fee-fallback", {
    level: LogLevel.ERROR,
  });
  fallbackLogger.error(
    "Unhandled error:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});