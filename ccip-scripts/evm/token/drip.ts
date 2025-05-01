import { ethers } from "ethers";
import {
  LogLevel,
  createLogger,
  createBurnMintERC677HelperClient,
  CCIPEVMContext,
  MultiDripOptions,
} from "../../../ccip-lib/evm";
import { 
  ChainId, 
  getEVMConfig 
} from "../../config";
import { createCCIPClient } from "../utils/client-factory";
import { parseCommonArgs, printUsage } from "../utils/config-parser";
import { formatBalance } from "../utils/provider";

/**
 * Script for dripping test tokens from a faucet contract
 */
async function dripTokens(): Promise<void> {
  let logger;
  try {
    // Parse command line arguments
    const options = parseCommonArgs();

    // Check for help flag
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      printUsage("evm:drip");
      process.exit(0);
    }

    // Create logger
    logger = createLogger("drip-tokens", {
      level: options.logLevel ?? LogLevel.INFO,
    });

    // Get network configuration
    const sourceChain = ChainId.ETHEREUM_SEPOLIA;
    const config = getEVMConfig(sourceChain);

    // Display environment info
    logger.info("\n==== Environment Information ====");
    logger.info(`Network: ${config.name}`);
    logger.info(`Token Address: ${config.bnmTokenAddress}`);

    // Create CCIP client for provider access
    const client = createCCIPClient({
      ...options,
      chainId: config.id, // Pass chainId from config to match pattern in token-transfer.ts
    });

    // Get signer address
    const signerAddress =
      "signer" in client.provider
        ? await client.provider.getAddress()
        : options.receiver;

    // If no signer available, we must have a receiver specified
    if (!signerAddress) {
      throw new Error("No signer available and no receiver specified");
    }

    logger.info(`Wallet Address: ${signerAddress}`);

    // Check wallet balance
    const balance = await client.provider.provider.getBalance(signerAddress);
    logger.info(`Native Balance: ${formatBalance(balance)} ETH`);

    if (balance < ethers.parseEther("0.005")) {
      logger.warn(
        "⚠️ Warning: Low wallet balance. You may not have enough for gas fees."
      );
    }

    // Determine the destination receiver address
    const receiver = options.receiver || signerAddress;

    // Determine the loop count (defaults to 1)
    const loopCount = options.amount ? parseInt(options.amount) : 1;

    // Create context for the token client
    const tokenContext: CCIPEVMContext = {
      provider: client.provider,
      config: client.config,
      logger,
    };

    // Create BurnMintERC677Helper client using the factory function
    const tokenClient = createBurnMintERC677HelperClient(
      tokenContext,
      config.bnmTokenAddress
    );

    // Get token details
    const tokenSymbol = await tokenClient.getSymbol();

    // Display drip summary
    logger.info("\n==== Drip Configuration ====");
    logger.info(`Token: ${tokenSymbol} (${config.bnmTokenAddress})`);
    logger.info(`Receiver: ${receiver}`);
    logger.info(`Number of Drips: ${loopCount}`);

    // Configure multi-drip options
    const multiDripOptions: MultiDripOptions = {
      delayMs: 2000, // 2 seconds between operations
      continueOnError: false, // Stop on error
      onProgress: (index, total, receipt, error) => {
        if (receipt) {
          logger.debug(
            `Transaction ${index}/${total} confirmed. Gas used: ${receipt.gasUsed}`
          );
        }
      },
    };

    // Execute multi-drip operation
    logger.info("\nStarting drip operation(s)...");
    const result = await tokenClient.multiDrip(
      receiver,
      loopCount,
      multiDripOptions
    );

    // Display results
    logger.info("\n==== Results ====");
    logger.info(
      `Operations completed: ${result.successfulOperations}/${result.totalOperations}`
    );

    const formattedInitial = await tokenClient.formatAmount(
      result.initialBalance
    );
    const formattedFinal = await tokenClient.formatAmount(result.finalBalance);
    const formattedGain = await tokenClient.formatAmount(result.tokensGained);

    logger.info(`Initial Balance: ${formattedInitial} ${tokenSymbol}`);
    logger.info(`Final Balance: ${formattedFinal} ${tokenSymbol}`);
    logger.info(`Gained: ${formattedGain} ${tokenSymbol}`);

    if (result.failedOperations > 0) {
      logger.warn(`${result.failedOperations} operations failed:`);
      result.errors.forEach((error, index) => {
        logger.warn(`  Error ${index + 1}: ${error}`);
      });
    }

    logger.info("\n🎉 Drip operations completed!");
  } catch (error) {
    // Use the logger if it exists, otherwise fallback to console
    if (!logger) {
      logger = createLogger("drip-tokens", {
        level: LogLevel.ERROR,
      });
    }
    
    logger.error("\n❌ Error executing drip operation:");
    if (error instanceof Error) {
      logger.error(error.message);
      if (error.stack) {
        logger.error(error.stack);
      }
    } else {
      logger.error(String(error));
    }

    printUsage("evm:drip");
    process.exit(1);
  }
}

// Run the script
dripTokens().catch((error) => {
  const fallbackLogger = createLogger("drip-tokens", {
    level: LogLevel.ERROR,
  });
  fallbackLogger.error("Unhandled error in dripTokens:", error);
});
