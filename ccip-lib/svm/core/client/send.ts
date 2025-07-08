import {
  PublicKey,
  VersionedTransaction,
  Connection,
  AccountMeta,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { Logger } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import { detectTokenProgram } from "../../utils/token";
import {
  CCIPContext,
  CCIPSendRequest,
  CCIPSendOptions,
  CCIPCoreConfig,
} from "../models";
import { CCIPAccountReader } from "./accounts";
import {
  ccipSend,
  CcipSendAccounts,
  CcipSendArgs,
} from "../../bindings/instructions/ccipSend";
import {
  findConfigPDA,
  findDestChainStatePDA,
  findNoncePDA,
  findFeeBillingSignerPDA,
  findFqConfigPDA,
  findFqDestChainPDA,
  findFqBillingTokenConfigPDA,
  findFqPerChainPerTokenConfigPDA,
  findRMNRemoteConfigPDA,
  findRMNRemoteCursesPDA,
  findTokenPoolChainConfigPDA,
} from "../../utils/pdas";

/**
 * Sends a CCIP message
 *
 * @param context SDK context with provider, config and logger
 * @param request Send request parameters
 * @param accountReader Account reader instance
 * @param computeBudgetInstruction Optional compute budget instruction
 * @param sendOptions Optional send options (skipPreflight, etc.)
 * @returns Transaction signature
 */
export async function sendCCIPMessage(
  context: CCIPContext,
  request: CCIPSendRequest,
  accountReader: CCIPAccountReader,
  computeBudgetInstruction?: TransactionInstruction,
  sendOptions?: CCIPSendOptions
): Promise<string> {
  if (!context.logger) {
    throw new Error("Logger is required for sendCCIPMessage");
  }

  const logger = context.logger;
  const config = context.config;
  const connection = context.provider.connection;
  const enhanceError = createErrorEnhancer(logger);

  logger.info(
    `Sending CCIP message to destination chain ${request.destChainSelector.toString()}`
  );

  // Determine if we're using native SOL
  const isNativeSol = request.feeToken.equals(PublicKey.default);

  // For native SOL, we use NATIVE_MINT as the token mint
  const feeTokenMint = isNativeSol ? NATIVE_MINT : request.feeToken;

  logger.debug(
    `Using fee token: ${feeTokenMint.toString()} (${
      isNativeSol ? "Native SOL" : "SPL Token"
    })`
  );

  // Determine the correct fee token program ID
  let feeTokenProgramId = TOKEN_PROGRAM_ID;
  if (!isNativeSol) {
    feeTokenProgramId = await detectTokenProgram(
      feeTokenMint,
      connection,
      logger
    );
  }

  const selectorBigInt = BigInt(request.destChainSelector.toString());
  const signerPublicKey = context.provider.getAddress();

  // Build the accounts for the ccipSend instruction
  const accounts = await buildCCIPSendAccounts(
    config,
    selectorBigInt,
    request,
    feeTokenMint,
    feeTokenProgramId,
    isNativeSol,
    signerPublicKey,
    logger
  );

  // Build token indexes and accounts
  const { tokenIndexes, remainingAccounts, lookupTableList } =
    await buildTokenAccountsForSend(
      request,
      connection,
      feeTokenProgramId,
      accountReader,
      logger,
      config,
      signerPublicKey
    );

  // Create the args for the ccipSend instruction
  const args: CcipSendArgs = {
    destChainSelector: request.destChainSelector,
    message: {
      receiver: request.receiver,
      data: request.data,
      tokenAmounts: request.tokenAmounts,
      feeToken: request.feeToken,
      extraArgs: request.extraArgs,
    },
    tokenIndexes: new Uint8Array(tokenIndexes),
  };

  // Create the ccipSend instruction
  const instruction = ccipSend(args, accounts, config.ccipRouterProgramId);

  // Add remaining accounts to the instruction
  if (remainingAccounts.length > 0) {
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

  // Get recent blockhash with longer validity
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash({
      commitment: "finalized", // Using finalized for longer validity
    });

  // Create the transaction instructions array
  const instructions: TransactionInstruction[] = [];

  // Add compute budget instruction if provided
  if (computeBudgetInstruction) {
    instructions.push(computeBudgetInstruction);
  }

  // Add the ccipSend instruction
  instructions.push(instruction);

  // Create the transaction
  const messageV0 = new TransactionMessage({
    payerKey: signerPublicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTableList);

  const tx = new VersionedTransaction(messageV0);
  await context.provider.signTransaction(tx);

  // Send the transaction with improved options
  const signature = await connection.sendTransaction(tx, {
    skipPreflight: sendOptions?.skipPreflight ?? false,
    preflightCommitment: "processed", // Faster preflight check
    maxRetries: 5, // Increased retries
  });

  // Handle transaction confirmation differently based on skipPreflight setting
  if (sendOptions?.skipPreflight) {
    // When skipPreflight is enabled, we want to return the signature even if the transaction fails
    logger.warn("⚠️  skipPreflight enabled - returning signature without waiting for confirmation");
    logger.info(`Transaction submitted with signature: ${signature}`);
    
    try {
      // Still try to confirm but don't fail if it errors
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "finalized"
      );
      logger.info(`CCIP message sent successfully: ${signature}`);
    } catch (confirmError) {
      logger.warn(`Transaction confirmation failed, but transaction was submitted: ${signature}`);
      // Don't throw the error, just log it and return the signature
      logger.debug(`Confirmation error: ${confirmError instanceof Error ? confirmError.message : String(confirmError)}`);
    }
  } else {
    // Normal confirmation behavior when skipPreflight is false
    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "finalized"
    );
    logger.info(`CCIP message sent successfully: ${signature}`);
  }

  return signature;
}

/**
 * Build accounts required for the ccipSend instruction
 */
async function buildCCIPSendAccounts(
  config: CCIPCoreConfig,
  selectorBigInt: bigint,
  request: CCIPSendRequest,
  feeTokenMint: PublicKey,
  feeTokenProgramId: PublicKey,
  isNativeSol: boolean,
  signerPublicKey: PublicKey,
  logger: Logger
): Promise<CcipSendAccounts> {
  const enhanceError = createErrorEnhancer(logger);

  try {
    logger.info(
      `Building accounts for CCIP send to chain ${selectorBigInt.toString()}`
    );
    logger.debug(
      `Fee token: ${feeTokenMint.toString()} (${
        isNativeSol ? "Native SOL" : "SPL Token"
      })`
    );

    // Find all the PDAs needed for the ccipSend instruction
    const [configPDA] = findConfigPDA(config.ccipRouterProgramId);
    const [destChainState] = findDestChainStatePDA(
      selectorBigInt,
      config.ccipRouterProgramId
    );
    const [nonce] = findNoncePDA(
      selectorBigInt,
      signerPublicKey,
      config.ccipRouterProgramId
    );
    const [feeBillingSigner] = findFeeBillingSignerPDA(
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
    const [rmnRemoteCurses] = findRMNRemoteCursesPDA(config.rmnRemoteProgramId);
    const [rmnRemoteConfig] = findRMNRemoteConfigPDA(config.rmnRemoteProgramId);

    // Get the associated token accounts for the user and fee billing signer
    logger.debug(
      `Deriving token accounts for fee token: ${feeTokenMint.toString()}`
    );

    const userFeeTokenAccount = isNativeSol
      ? PublicKey.default // For native SOL we use the default public key
      : await getAssociatedTokenAddress(
          feeTokenMint,
          signerPublicKey,
          true,
          feeTokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

    const feeBillingSignerFeeTokenAccount = await getAssociatedTokenAddress(
      feeTokenMint,
      feeBillingSigner,
      true,
      feeTokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    return {
      authority: signerPublicKey,
      config: configPDA,
      destChainState: destChainState,
      nonce: nonce,
      systemProgram: SystemProgram.programId,
      feeTokenProgram: feeTokenProgramId,
      feeTokenMint: feeTokenMint,
      feeTokenUserAssociatedAccount: userFeeTokenAccount,
      feeTokenReceiver: feeBillingSignerFeeTokenAccount,
      feeBillingSigner: feeBillingSigner,
      feeQuoter: config.feeQuoterProgramId,
      feeQuoterConfig: feeQuoterConfig,
      feeQuoterDestChain: fqDestChain,
      feeQuoterBillingTokenConfig: fqBillingTokenConfig,
      feeQuoterLinkTokenConfig: fqLinkBillingTokenConfig,
      rmnRemote: config.rmnRemoteProgramId,
      rmnRemoteCurses: rmnRemoteCurses,
      rmnRemoteConfig: rmnRemoteConfig,
    };
  } catch (error) {
    // Use enhanceError to add context and properly log the error
    throw enhanceError(error, {
      operation: "buildCCIPSendAccounts",
      destChainSelector: selectorBigInt.toString(),
      feeToken: feeTokenMint.toString(),
      isNativeSol: isNativeSol,
    });
  }
}

/**
 * Build token accounts and indexes for CCIP send
 */
async function buildTokenAccountsForSend(
  request: CCIPSendRequest,
  connection: Connection,
  feeTokenProgramId: PublicKey,
  accountReader: CCIPAccountReader,
  logger: Logger,
  config: CCIPCoreConfig,
  signerPublicKey: PublicKey
): Promise<{
  tokenIndexes: number[];
  remainingAccounts: AccountMeta[];
  lookupTableList: AddressLookupTableAccount[];
}> {
  const enhanceError = createErrorEnhancer(logger);
  logger.debug(
    `Building token accounts for ${request.tokenAmounts.length} tokens`
  );

  // Setup token accounts
  const tokenIndexes: number[] = [];
  const remainingAccounts: AccountMeta[] = [];
  const lookupTableList: AddressLookupTableAccount[] = [];
  let lastIndex = 0;

  // Process each token amount
  for (const tokenAmount of request.tokenAmounts) {
    try {
      const tokenMint = tokenAmount.token;
      logger.debug(
        `Processing token: ${tokenMint.toString()}, amount: ${tokenAmount.amount.toString()}`
      );

      // Determine token program from token mint
      const tokenProgram = await detectTokenProgram(
        tokenMint,
        connection,
        logger
      );

      // Get token admin registry for this token to access lookup table
      const tokenAdminRegistry = await accountReader.getTokenAdminRegistry(
        tokenMint
      );

      logger.trace(
        `Retrieved token admin registry for ${tokenMint.toString()}: ${JSON.stringify(
          tokenAdminRegistry
        )}`
      );

      // Get lookup table for this token
      const lookupTable = await getLookupTableAccount(
        connection,
        tokenAdminRegistry.lookupTable,
        logger
      );
      lookupTableList.push(lookupTable);

      // Get the lookup table addresses
      const lookupTableAddresses = lookupTable.state.addresses;

      logger.trace(
        `Lookup table addresses: ${JSON.stringify(lookupTableAddresses)}`
      );

      // Extract pool program from lookup table
      const poolProgram = getPoolProgram(lookupTableAddresses, logger);

      // Get user token account - use the signer public key
      const userTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        signerPublicKey,
        true,
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      logger.trace(
        `Signer public key: ${signerPublicKey.toString()}, Signer user token account: ${userTokenAccount.toString()}`
      );

      // Get token chain config
      const [tokenBillingConfig] = findFqPerChainPerTokenConfigPDA(
        BigInt(request.destChainSelector.toString()),
        tokenMint,
        config.feeQuoterProgramId
      );

      logger.trace(
        `Token billing config for destination chain selector ${request.destChainSelector.toString()}, token mint ${tokenMint.toString()}, feeQuoterProgramId ${config.feeQuoterProgramId.toString()}: ${tokenBillingConfig.toString()}`
      );

      // Get pool chain config
      const [poolChainConfig] = findTokenPoolChainConfigPDA(
        BigInt(request.destChainSelector.toString()),
        tokenMint,
        poolProgram
      );

      logger.trace(
        `Pool chain config for destination chain selector ${request.destChainSelector.toString()}, token mint ${tokenMint.toString()}, poolProgram ${poolProgram.toString()}: ${poolChainConfig.toString()}`
      );

      // Build token accounts using lookup table
      const tokenAccounts = buildTokenLookupAccounts(
        userTokenAccount,
        tokenBillingConfig,
        poolChainConfig,
        lookupTableAddresses,
        tokenAdminRegistry.writableIndexes,
        logger
      );

      tokenIndexes.push(lastIndex);
      const currentLen = tokenAccounts.length;
      lastIndex += currentLen;
      remainingAccounts.push(...tokenAccounts);

      logger.debug(
        `Added ${currentLen} token-specific accounts for ${tokenMint.toString()}`
      );
      logger.trace(`Remaining accounts: ${JSON.stringify(remainingAccounts)}`);
    } catch (error) {
      throw enhanceError(error, {
        operation: "buildTokenAccountsForSend",
        token: tokenAmount.token.toString(),
        amount: tokenAmount.amount.toString(),
      });
    }
  }

  return { tokenIndexes, remainingAccounts, lookupTableList };
}

/**
 * Gets an address lookup table account
 */
async function getLookupTableAccount(
  connection: Connection,
  lookupTableAddress: PublicKey,
  logger: Logger
): Promise<AddressLookupTableAccount> {
  const enhanceError = createErrorEnhancer(logger);
  logger.debug(`Fetching lookup table: ${lookupTableAddress.toString()}`);

  const { value: lookupTableAccount } = await connection.getAddressLookupTable(
    lookupTableAddress
  );

  if (!lookupTableAccount) {
    throw enhanceError(
      new Error(`Lookup table not found: ${lookupTableAddress.toString()}`),
      {
        operation: "getLookupTableAccount",
        lookupTableAddress: lookupTableAddress.toString(),
      }
    );
  }

  if (lookupTableAccount.state.addresses.length < 7) {
    throw enhanceError(
      new Error(
        `Lookup table has insufficient accounts: ${lookupTableAccount.state.addresses.length} (needs at least 7)`
      ),
      {
        operation: "getLookupTableAccount",
        lookupTableAddress: lookupTableAddress.toString(),
        addressCount: lookupTableAccount.state.addresses.length,
      }
    );
  }

  logger.trace(
    `Lookup table fetched with ${lookupTableAccount.state.addresses.length} addresses`
  );
  return lookupTableAccount;
}

/**
 * Extracts the pool program from lookup table addresses
 */
function getPoolProgram(
  lookupTableAddresses: PublicKey[],
  logger: Logger
): PublicKey {
  const enhanceError = createErrorEnhancer(logger);
  // The pool program is at index 2 in the lookup table
  if (lookupTableAddresses.length <= 2) {
    throw enhanceError(
      new Error(
        "Lookup table doesn't have enough entries to determine pool program"
      ),
      { operation: "getPoolProgram", addressCount: lookupTableAddresses.length }
    );
  }

  const poolProgram = lookupTableAddresses[2];
  logger.debug(
    `Using pool program: ${poolProgram.toString()} (index 2 in lookup table)`
  );

  return poolProgram;
}

/**
 * Build token accounts using lookup table
 */
function buildTokenLookupAccounts(
  userTokenAccount: PublicKey,
  tokenBillingConfig: PublicKey,
  poolChainConfig: PublicKey,
  lookupTableEntries: Array<PublicKey>,
  writableIndexes: BN[],
  logger: Logger
): Array<AccountMeta> {
  // First entry is the lookup table itself
  const lookupTable = lookupTableEntries[0];

  logger.trace("Building token lookup accounts", {
    userTokenAccount: userTokenAccount.toString(),
    tokenBillingConfig: tokenBillingConfig.toString(),
    poolChainConfig: poolChainConfig.toString(),
    lookupTableAddress: lookupTable.toString(),
    entriesCount: lookupTableEntries.length,
  });

  // Build the token accounts with the correct writable flags
  const accounts = [
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: tokenBillingConfig, isSigner: false, isWritable: false },
    { pubkey: poolChainConfig, isSigner: false, isWritable: true },

    // First account is the lookup table - must be non-writable
    { pubkey: lookupTable, isSigner: false, isWritable: false },
  ];

  // Add the remaining lookup table entries with correct writable flags
  const remainingAccounts = lookupTableEntries.slice(1).map((pubkey, index) => {
    const isWrit = isWritable(index + 1, writableIndexes, logger);
    logger.trace(
      `Index: ${
        index + 1
      }, isWritable: ${isWrit}, Account pubkey: ${pubkey.toString()}`
    );
    return {
      pubkey,
      isSigner: false,
      isWritable: isWrit,
    };
  });

  return [...accounts, ...remainingAccounts];
}

/**
 * Checks if an account should be writable based on writable indexes bitmap
 */
function isWritable(
  index: number,
  writableIndexes: BN[],
  logger?: Logger
): boolean {
  // For the lookup table access, index 0 is determined by the program requirements
  // The lookup table itself must be NON-writable
  if (index === 0) {
    return false;
  }

  // For other accounts, check the writable indexes bitmap
  // Each BN in writableIndexes represents a 256-bit mask
  const bnIndex = Math.floor(index / 128);

  // In the Rust code, bits are set from left to right
  const bitPosition = bnIndex === 0 ? 127 - (index % 128) : 255 - (index % 128);

  if (bnIndex < writableIndexes.length) {
    // Create a BN with the bit at the position we want to check
    const mask = new BN(1).shln(bitPosition);

    // Check if the bit is set using bitwise AND
    const result = writableIndexes[bnIndex].and(mask);

    // If the result is not zero, the bit is set
    return !result.isZero();
  }

  // Default to non-writable if index is out of bounds
  return false;
}
