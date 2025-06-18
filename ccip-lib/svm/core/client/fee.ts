import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { AccountMeta } from "@solana/web3.js";
import { createErrorEnhancer } from "../../utils/errors";
import { CCIPFeeRequest, CCIPContext, CCIPCoreConfig } from "../models";
import * as types from "../../bindings/types";
import { GetFeeResult } from "../../bindings/types/GetFeeResult";
import {
  findFqConfigPDA,
  findFqDestChainPDA,
  findFqBillingTokenConfigPDA,
  findFqPerChainPerTokenConfigPDA,
  findConfigPDA,
  findDestChainStatePDA,
} from "../../utils/pdas";
import {
  getFee,
  GetFeeAccounts,
  GetFeeArgs,
} from "../../bindings/instructions/getFee";

/**
 * Calculates the fee for a CCIP message
 *
 * @param context SDK context with provider, config and logger
 * @param request Fee request parameters
 * @returns Fee result
 */
export async function calculateFee(
  context: CCIPContext,
  request: CCIPFeeRequest
): Promise<types.GetFeeResult> {
  const logger = context.logger;
  const config = context.config;
  const connection = context.provider.connection;
  const signerPublicKey = context.provider.getAddress();

  if (!logger) {
    throw new Error("Logger is required for calculateFee");
  }

  const enhanceError = createErrorEnhancer(logger);
  const selectorBigInt = BigInt(request.destChainSelector.toString());

  logger.info(
    `Calculating fee for destination chain ${request.destChainSelector.toString()}`
  );

  const feeTokenMint = request.message.feeToken.equals(PublicKey.default)
    ? NATIVE_MINT
    : request.message.feeToken;

  logger.debug(
    `Using fee token: ${feeTokenMint.toString()} (${
      request.message.feeToken.equals(PublicKey.default)
        ? "Native SOL"
        : "SPL Token"
    })`
  );

  // Build the accounts needed for the getFee instruction
  logger.debug(`Building accounts for getFee instruction`);
  const accounts = await buildGetFeeAccounts(
    config,
    selectorBigInt,
    feeTokenMint
  );

  logger.trace("Fee accounts:", {
    config: accounts.config.toString(),
    destChainState: accounts.destChainState.toString(),
    feeQuoter: accounts.feeQuoter.toString(),
    feeQuoterConfig: accounts.feeQuoterConfig.toString(),
    feeQuoterDestChain: accounts.feeQuoterDestChain.toString(),
    feeQuoterBillingTokenConfig:
      accounts.feeQuoterBillingTokenConfig.toString(),
    feeQuoterLinkTokenConfig: accounts.feeQuoterLinkTokenConfig.toString(),
  });

  // Create the getFee instruction arguments
  logger.debug(`Creating getFee instruction arguments`);
  const args: GetFeeArgs = {
    destChainSelector: request.destChainSelector,
    message: {
      receiver: request.message.receiver,
      data: request.message.data,
      tokenAmounts: request.message.tokenAmounts,
      feeToken: request.message.feeToken,
      extraArgs: request.message.extraArgs,
    },
  };

  // Create instruction
  logger.debug(`Creating getFee instruction`);
  const instruction = getFee(args, accounts, config.ccipRouterProgramId);

  // Build and add token-specific remaining accounts for each token in tokenAmounts
  let remainingAccounts: AccountMeta[] = [];

  // Process each token in tokenAmounts
  logger.debug(
    `Processing ${request.message.tokenAmounts.length} token amounts for remaining accounts`
  );
  for (const tokenAmount of request.message.tokenAmounts) {
    try {
      logger.trace(
        `Processing token: ${tokenAmount.token.toString()}, amount: ${tokenAmount.amount.toString()}`
      );

      // Find the token billing config PDA
      const [tokenBillingConfig] = findFqBillingTokenConfigPDA(
        tokenAmount.token,
        config.feeQuoterProgramId
      );

      // Find the per chain per token config PDA
      const [perChainPerTokenConfig] = findFqPerChainPerTokenConfigPDA(
        selectorBigInt,
        tokenAmount.token,
        config.feeQuoterProgramId
      );

      logger.trace(`Found token configs:`, {
        tokenBillingConfig: tokenBillingConfig.toString(),
        perChainPerTokenConfig: perChainPerTokenConfig.toString(),
      });

      // Add these accounts to the remaining accounts
      remainingAccounts.push(
        { pubkey: tokenBillingConfig, isWritable: false, isSigner: false },
        { pubkey: perChainPerTokenConfig, isWritable: false, isSigner: false }
      );
    } catch (error) {
      // Log the error with context but continue with other tokens
      enhanceError(error, {
        operation: "getFee:processToken",
        token: tokenAmount.token.toString(),
        amount: tokenAmount.amount.toString(),
        destChainSelector: selectorBigInt.toString(),
      });
      // Continue with other tokens if one fails
    }
  }

  // Add remaining accounts to the instruction
  if (remainingAccounts.length > 0) {
    logger.debug(
      `Adding ${remainingAccounts.length} remaining accounts to the instruction`
    );
    instruction.keys.push(...remainingAccounts);
  }

  // Log complete instruction accounts in TRACE mode
  logger.trace(
    "Complete instruction accounts:",
    instruction.keys.map((key, index) => ({
      index,
      pubkey: key.pubkey.toString(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    }))
  );

  // Get recent blockhash
  logger.debug(`Getting recent blockhash for transaction`);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  // Create transaction
  logger.debug(`Creating versioned transaction for simulation`);
  const messageV0 = new TransactionMessage({
    payerKey: signerPublicKey,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  await context.provider.signTransaction(tx);

  // Simulate transaction to get the return data
  logger.debug(`Simulating transaction to get fee result`);
  const simulation = await connection.simulateTransaction(tx, {
    commitment: "confirmed",
    sigVerify: false,
  });

  // Parse the return data
  if (simulation.value.logs) {
    logger.trace(`Simulation logs:`, simulation.value.logs);

    const ccipReturnLog = simulation.value.logs.find((log) =>
      log.includes(`Program return: ${config.ccipRouterProgramId.toString()}`)
    );

    if (ccipReturnLog) {
      logger.debug(`Found CCIP program return log`);
      const parts = ccipReturnLog.split(
        `Program return: ${config.ccipRouterProgramId.toString()} `
      );
      if (parts.length > 1) {
        const base64Data = parts[1].trim();
        const buffer = Buffer.from(base64Data, "base64");

        // Use the proper bindings to decode the result
        logger.debug(`Decoding fee result data`);
        const feeResultData = GetFeeResult.layout().decode(buffer);
        const result = GetFeeResult.fromDecoded(feeResultData);

        logger.info(
          `Fee calculation complete: ${result.amount.toString()} tokens`
        );
        return result;
      }
    }

    logger.error(`Could not find CCIP program return log in simulation logs`);
  } else {
    logger.error(`Simulation did not return any logs`);
  }

  throw enhanceError(
    new Error("Could not parse fee from transaction return data"),
    {
      operation: "getFee",
      destChainSelector: request.destChainSelector.toString(),
      feeToken: request.message.feeToken.toString(),
      simulationStatus: simulation?.value?.err || "No specific error",
      hasLogs: !!simulation?.value?.logs,
      logCount: simulation?.value?.logs?.length || 0,
    }
  );
}

/**
 * Build accounts required for the getFee instruction
 * @param config SDK configuration
 * @param selectorBigInt Chain selector as BigInt
 * @param feeTokenMint Fee token mint address
 * @returns GetFeeAccounts object with all required accounts
 */
async function buildGetFeeAccounts(
  config: CCIPCoreConfig,
  selectorBigInt: bigint,
  feeTokenMint: PublicKey
): Promise<GetFeeAccounts> {
  const [configPDA] = findConfigPDA(config.ccipRouterProgramId);
  const [destChainState] = findDestChainStatePDA(
    selectorBigInt,
    config.ccipRouterProgramId
  );
  const [feeQuoterConfig] = findFqConfigPDA(config.feeQuoterProgramId);
  const [fqDestChain] = findFqDestChainPDA(
    selectorBigInt,
    config.feeQuoterProgramId
  );
  const [fqBillingTokenConfig] = findFqBillingTokenConfigPDA(
    feeTokenMint,
    config.feeQuoterProgramId
  );
  const [fqLinkBillingTokenConfig] = findFqBillingTokenConfigPDA(
    config.linkTokenMint,
    config.feeQuoterProgramId
  );

  return {
    config: configPDA,
    destChainState: destChainState,
    feeQuoter: config.feeQuoterProgramId,
    feeQuoterConfig: feeQuoterConfig,
    feeQuoterDestChain: fqDestChain,
    feeQuoterBillingTokenConfig: fqBillingTokenConfig,
    feeQuoterLinkTokenConfig: fqLinkBillingTokenConfig,
  };
}
