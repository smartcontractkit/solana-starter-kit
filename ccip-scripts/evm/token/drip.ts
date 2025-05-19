import { ethers } from "ethers";
import {
  LogLevel,
  createLogger,
  createBurnMintERC677HelperClient,
  CCIPEVMContext,
  MultiDripOptions,
  CCIPEVMWriteProvider,
  BurnMintERC677HelperClient,
} from "../../../ccip-lib/evm";
import { ChainId, getEVMConfig } from "../../config";
import { createCCIPClient } from "../utils/client-factory";
import { parseCommonArgs, printUsage } from "../utils/config-parser";
import { formatBalance } from "../utils/provider";
import { Logger } from "../../../ccip-lib/evm/core/models";

// ABI for the Faucet contract
const FAUCET_ABI = [
  {
    inputs: [
      { internalType: "address", name: "initialTokenAddress", type: "address" },
      { internalType: "uint256", name: "initialDripAmount", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "InvalidDripAmount",
    type: "error",
  },
  { inputs: [], name: "TokenAddressCannotBeZero", type: "error" },
  { inputs: [], name: "TokenMintFailed", type: "error" },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "newAmount",
        type: "uint256",
      },
    ],
    name: "DripAmountUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
    ],
    name: "OwnershipTransferRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "newTokenAddress",
        type: "address",
      },
    ],
    name: "TokenContractUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "TokensDispensed",
    type: "event",
  },
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "drip",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "dripAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTokenAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "newAmount", type: "uint256" }],
    name: "setDripAmount",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "newTokenAddress", type: "address" },
      {
        internalType: "uint256",
        name: "newInitialDripAmount",
        type: "uint256",
      },
    ],
    name: "setTokenContract",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token",
    outputs: [
      { internalType: "contract IBurnMintERC20", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "to", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

interface DripAttemptResult {
  initialBalance: bigint;
  finalBalance: bigint;
  tokensGained: bigint;
  successfulOperations: number;
  totalOperations: number;
  errors: string[];
}

async function attemptFaucetDrip(
  signer: ethers.Signer,
  tokenClient: BurnMintERC677HelperClient,
  faucetAddress: string,
  receiver: string,
  loopCount: number,
  multiDripOptions: MultiDripOptions,
  logger: Logger,
  tokenSymbol: string
): Promise<DripAttemptResult> {
  logger.info(
    `\nAttempting fallback drip from faucet contract at ${faucetAddress}...`
  );

  const faucetContract = new ethers.Contract(faucetAddress, FAUCET_ABI, signer);

  let successfulFaucetDrips = 0;
  const faucetErrors: string[] = [];
  const initialBalance = await tokenClient.getBalance(receiver);

  logger.info(
    `Initial ${tokenSymbol} balance for ${receiver} (before faucet drips): ${await tokenClient.formatAmount(
      initialBalance
    )}`
  );

  for (let i = 0; i < loopCount; i++) {
    try {
      logger.info(
        `Attempting faucet drip ${i + 1}/${loopCount} via ${faucetAddress}...`
      );
      const tx = await faucetContract.drip();
      const receipt = await tx.wait(2);
      logger.debug(
        `Faucet drip ${i + 1}/${loopCount} (tx: ${
          tx.hash
        }) confirmed. Gas used: ${receipt?.gasUsed ?? "N/A"}`
      );
      if (multiDripOptions.onProgress && receipt) {
        multiDripOptions.onProgress(i + 1, loopCount, receipt, null);
      }
      successfulFaucetDrips++;
    } catch (faucetOpError) {
      const errMsg =
        faucetOpError instanceof Error
          ? faucetOpError.message
          : String(faucetOpError);
      logger.error(
        `Faucet drip ${
          i + 1
        }/${loopCount} from ${faucetAddress} failed: ${errMsg}`
      );
      faucetErrors.push(errMsg);
      if (multiDripOptions.onProgress) {
        multiDripOptions.onProgress(
          i + 1,
          loopCount,
          null,
          faucetOpError as Error
        );
      }
      if (!multiDripOptions.continueOnError) {
        logger.warn(
          "Stopping faucet drips due to error (continueOnError is false)."
        );
        break;
      }
    }
    if (i < loopCount - 1 && multiDripOptions.delayMs > 0) {
      logger.debug(
        `Waiting ${multiDripOptions.delayMs}ms before next faucet drip...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, multiDripOptions.delayMs)
      );
    }
  }

  const finalBalance = await tokenClient.getBalance(receiver);
  const tokensGained = finalBalance - initialBalance;

  return {
    initialBalance,
    finalBalance,
    tokensGained,
    successfulOperations: successfulFaucetDrips,
    totalOperations: loopCount,
    errors: faucetErrors,
  };
}

/**
 * Script for dripping test tokens from a faucet contract
 */
async function dripTokens(): Promise<void> {
  let logger: Logger;
  let configuredLogLevel: LogLevel | undefined = undefined;
  let signer: ethers.Signer;
  let tokenClient: BurnMintERC677HelperClient;
  let tokenSymbol: string;
  let config: ReturnType<typeof getEVMConfig>;
  let loopCount: number;
  let multiDripOptions: MultiDripOptions;
  let signerAddress: string;

  try {
    // Parse command line arguments
    const options = parseCommonArgs();

    // Check for help flag
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      printUsage("evm:drip");
      process.exit(0);
    }

    configuredLogLevel = options.logLevel ?? LogLevel.INFO;
    logger = createLogger("drip-tokens", {
      level: configuredLogLevel,
    });

    // Get network configuration
    const sourceChain = ChainId.ETHEREUM_SEPOLIA;
    config = getEVMConfig(sourceChain);

    // Display environment info
    logger.info("\n==== Environment Information ====");
    logger.info(`Network: ${config.name}`);
    logger.info(`Token Address: ${config.bnmTokenAddress}`);
    if (config.faucetAddress) {
      logger.info(`Faucet Address: ${config.faucetAddress}`);
    }

    // Create CCIP client for provider access
    const client = createCCIPClient({
      ...options,
      chainId: config.id,
    });

    // Get signer and address
    signer = (client.provider as CCIPEVMWriteProvider).signer;
    signerAddress = await signer.getAddress();

    logger.info(
      `Native Balance for ${signerAddress} (for gas): ${formatBalance(
        await client.provider.provider.getBalance(signerAddress)
      )} ETH`
    );

    if (
      (await client.provider.provider.getBalance(signerAddress)) <
      ethers.parseEther("0.005")
    ) {
      logger.warn(
        "⚠️ Warning: Low native balance for gas fees. Transactions may fail."
      );
    }

    loopCount = options.amount ? parseInt(options.amount) : 1;

    const tokenContext: CCIPEVMContext = {
      provider: client.provider,
      config: client.config,
      logger,
    };

    tokenClient = createBurnMintERC677HelperClient(
      tokenContext,
      config.bnmTokenAddress
    );
    tokenSymbol = await tokenClient.getSymbol();

    logger.info("\n==== Drip Configuration ====");
    logger.info(`Token: ${tokenSymbol} (${config.bnmTokenAddress})`);
    logger.info(`Target Receiver for Drips: ${signerAddress}`);
    logger.info(`Number of Drips per attempt: ${loopCount}`);

    multiDripOptions = {
      delayMs: 2000,
      continueOnError: false,
      onProgress: (index, total, receipt, error) => {
        if (receipt) {
          logger.debug(
            `Transaction ${index}/${total} confirmed. Gas used: ${receipt.gasUsed}`
          );
        } else if (error) {
          logger.warn(`Transaction ${index}/${total} failed: ${error.message}`);
        }
      },
    };

    // Variables to store the outcome of the primary attempt
    let primaryAttemptSuccessful = false;
    let primaryAttemptResultData: DripAttemptResult | null = null; // To store data if multiDrip doesn't throw
    let errorFromPrimaryThrow: Error | null = null;

    // --- Primary Token Drip Attempt ---
    logger.info(
      "\nStarting primary drip operation(s) via token contract's multiDrip..."
    );
    try {
      const tokenDripResult = await tokenClient.multiDrip(
        signerAddress,
        loopCount,
        multiDripOptions
      );
      primaryAttemptResultData = tokenDripResult; // Store the full result

      if (tokenDripResult.successfulOperations > 0) {
        primaryAttemptSuccessful = true;
        logger.info(
          `Primary drip via token contract successful: ${tokenDripResult.successfulOperations} operation(s).`
        );
      } else {
        logger.warn(
          `Primary drip via token contract completed but with 0 successful operations. Errors: ${tokenDripResult.errors.join(
            "; "
          )}`
        );
        // primaryAttemptSuccessful remains false
      }
    } catch (error) {
      errorFromPrimaryThrow =
        error instanceof Error ? error : new Error(String(error));
      logger.warn(
        `Primary drip via token contract failed with an EXCEPTION: ${errorFromPrimaryThrow.message}`
      );
      if (
        errorFromPrimaryThrow.stack &&
        configuredLogLevel === LogLevel.DEBUG
      ) {
        logger.debug(errorFromPrimaryThrow.stack);
      }
      // primaryAttemptSuccessful remains false
    }

    let finalDripResult: DripAttemptResult & {
      dripSource: "token" | "faucet" | "none";
    };

    if (primaryAttemptSuccessful && primaryAttemptResultData) {
      finalDripResult = { ...primaryAttemptResultData, dripSource: "token" };
    } else {
      // Primary attempt was not successful (either 0 successes or threw an error).
      // Prepare a tentative finalDripResult reflecting primary failure.
      // This will be overwritten if faucet succeeds.
      const balanceForFailureState = await tokenClient.getBalance(
        signerAddress
      );
      const errorsFromPrimaryAttempt =
        primaryAttemptResultData?.errors || // Errors if multiDrip completed with 0 success
        (errorFromPrimaryThrow ? [errorFromPrimaryThrow.message] : []); // Error if multiDrip threw

      finalDripResult = {
        initialBalance:
          primaryAttemptResultData?.initialBalance ?? balanceForFailureState,
        finalBalance:
          primaryAttemptResultData?.finalBalance ?? balanceForFailureState,
        tokensGained: primaryAttemptResultData?.tokensGained ?? BigInt(0),
        successfulOperations: 0,
        totalOperations: loopCount,
        errors: errorsFromPrimaryAttempt,
        dripSource: "none", // Tentatively 'none', to be updated if faucet works
      };

      // --- Fallback Faucet Drip Attempt ---
      if (config.faucetAddress) {
        logger.info(
          `Primary drip was unsuccessful. Attempting fallback to faucet drip at ${config.faucetAddress}.`
        );
        try {
          const faucetDripResultData = await attemptFaucetDrip(
            signer,
            tokenClient,
            config.faucetAddress,
            signerAddress, // Receiver for faucet drip balance checks
            loopCount,
            multiDripOptions,
            logger,
            tokenSymbol
          );

          if (faucetDripResultData.successfulOperations > 0) {
            finalDripResult = { ...faucetDripResultData, dripSource: "faucet" }; // Faucet successful
            logger.info(
              `Fallback faucet drip successful: ${faucetDripResultData.successfulOperations} operation(s).`
            );
          } else {
            // Faucet attempted but resulted in 0 successful operations
            logger.warn(
              `Fallback faucet drip completed but with 0 successful operations. Errors: ${faucetDripResultData.errors.join(
                "; "
              )}`
            );
            // Combine errors from primary attempt and faucet attempt.
            // Balances from faucet attempt are more relevant now as it was the last one.
            finalDripResult = {
              ...faucetDripResultData, // Contains balances from faucet attempt
              errors: [
                ...new Set([
                  ...errorsFromPrimaryAttempt,
                  ...faucetDripResultData.errors,
                ]),
              ].filter((e) => e),
              dripSource: "none", // Overall failure
            };
          }
        } catch (faucetErrorObj) {
          const caughtFaucetError =
            faucetErrorObj instanceof Error
              ? faucetErrorObj
              : new Error(String(faucetErrorObj));
          logger.error(
            `Fallback faucet drip failed with an EXCEPTION: ${caughtFaucetError.message}`
          );
          if (
            caughtFaucetError.stack &&
            configuredLogLevel === LogLevel.DEBUG
          ) {
            logger.debug(caughtFaucetError.stack);
          }
          // Faucet threw. finalDripResult should reflect this, combining with primary errors.
          // Balances should reflect state after catastrophic faucet failure.
          // The 'initialBalance' in finalDripResult was set based on primary failure state or current balance.
          // The 'finalBalance' should be current balance after faucet exception.
          const balanceAfterFaucetException = await tokenClient.getBalance(
            signerAddress
          );
          finalDripResult = {
            // Use initialBalance from before this failed faucet attempt (it's already in finalDripResult from primary failure handling)
            initialBalance: finalDripResult.initialBalance,
            finalBalance: balanceAfterFaucetException,
            tokensGained: BigInt(0), // No gain from this failed faucet exception
            successfulOperations: 0,
            totalOperations: loopCount,
            errors: [
              ...new Set([
                ...errorsFromPrimaryAttempt,
                caughtFaucetError.message,
              ]),
            ].filter((e) => e),
            dripSource: "none",
          };
        }
      } else {
        logger.warn(
          "Primary drip was unsuccessful, and no faucet address is configured. No fallback attempted."
        );
        // finalDripResult is already set up to reflect primary failure and dripSource 'none'.
      }
    }

    // Display results
    logger.info("\n==== Drip Operation Summary ====");
    logger.info(`Drip Source: ${finalDripResult.dripSource}`);
    logger.info(
      `Operations completed: ${finalDripResult.successfulOperations}/${finalDripResult.totalOperations}`
    );

    const formattedInitial = await tokenClient.formatAmount(
      finalDripResult.initialBalance
    );
    const formattedFinal = await tokenClient.formatAmount(
      finalDripResult.finalBalance
    );
    const formattedGain = await tokenClient.formatAmount(
      finalDripResult.tokensGained
    );

    logger.info(
      `Initial ${tokenSymbol} Balance (for ${signerAddress}): ${formattedInitial}`
    );
    logger.info(
      `Final ${tokenSymbol} Balance (for ${signerAddress}): ${formattedFinal}`
    );
    logger.info(
      `Net ${tokenSymbol} Gained (for ${signerAddress}): ${formattedGain}`
    );

    if (finalDripResult.errors.length > 0) {
      logger.warn(
        `${finalDripResult.errors.length} individual operation(s) within the chosen/attempted drip method(s) reported errors:`
      );
      finalDripResult.errors.forEach((e, index) => {
        logger.warn(`  Error ${index + 1}: ${e}`);
      });
    }

    if (finalDripResult.successfulOperations > 0) {
      logger.info(
        `\n🎉 Drip operations concluded successfully via ${finalDripResult.dripSource}!`
      );
    } else {
      logger.error("\n❌ All drip attempts ultimately failed.");
      const combinedErrors =
        finalDripResult.errors.join("; ") ||
        "No specific error messages provided by attempts.";
      throw new Error(
        `All drip attempts failed. Final source evaluated: '${finalDripResult.dripSource}'. Errors: ${combinedErrors}`
      );
    }
  } catch (error) {
    // This top-level catch handles errors from setup, or the re-thrown error from drip failures.
    const errorLogger =
      logger ?? // logger might not be initialized if error is very early
      createLogger("drip-tokens-error-handler", { level: LogLevel.ERROR });
    const logLevelForStack = logger ? configuredLogLevel : LogLevel.ERROR;

    errorLogger.error("\n❌ Error executing overall drip script:");
    if (error instanceof Error) {
      errorLogger.error(error.message);
      if (error.stack && logLevelForStack === LogLevel.DEBUG) {
        errorLogger.error(error.stack);
      }
    } else {
      errorLogger.error(String(error));
    }

    printUsage("evm:drip");
    process.exit(1);
  }
}

// Run the script
dripTokens().catch((error) => {
  // This catch is for truly unhandled errors from dripTokens promise itself,
  // or errors thrown if the logger setup itself failed.
  const fallbackLogger = createLogger("drip-tokens-fallback", {
    level: LogLevel.ERROR,
  });
  fallbackLogger.error(
    "Unhandled error in dripTokens execution flow:",
    error instanceof Error ? error.message : String(error)
  );
  if (error instanceof Error && error.stack) {
    fallbackLogger.error("Stack trace:", error.stack);
  }
  process.exit(1);
});
