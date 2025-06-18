/**
 * SOL to wSOL Wrapper Utility
 *
 * This script wraps native SOL to wSOL (Wrapped SOL), which is necessary for
 * using SOL in token operations that require SPL Token compatibility.
 *
 * The amounts are expressed in lamports (absolute raw values), not SOL units,
 * 1 SOL = 1,000,000,000 lamports
 */
import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  loadKeypair,
  parseTokenArgs,
  printUsage,
  getKeypairPath,
} from "../utils";
import { ChainId, getCCIPSVMConfig } from "../../config";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

// Get configuration - we only support Solana Devnet for now
const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

// =================================================================
// SOL WRAPPING CONFIGURATION
// Core parameters for SOL wrapping operations
// =================================================================
const WRAP_SOL_CONFIG = {
  // Default amount of lamports to wrap (absolute raw value)
  // 100,000,000 lamports = 0.1 SOL
  defaultAmount: "100000000",

  // Description for token information
  tokenDescription: "Wrapped SOL (wSOL)",
};

/**
 * Extended options for SOL wrapping operations
 */
interface WrapSolOptions extends ReturnType<typeof parseTokenArgs> {
  logLevel?: LogLevel;
}

/**
 * Result of SOL wrapping operation
 */
interface WrapSolResult {
  signature: string;
  amountWrapped: bigint;
  newWsolBalance: string;
}

/**
 * Parse command line arguments for SOL wrapping operations
 */
function parseWrapSolArgs(): WrapSolOptions {
  const tokenOptions = parseTokenArgs();
  const args = process.argv.slice(2);
  const options: WrapSolOptions = {
    ...tokenOptions,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--log-level" && i + 1 < args.length) {
      const logLevel = args[i + 1].toUpperCase();
      if (
        ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "SILENT"].includes(logLevel)
      ) {
        options.logLevel = logLevel as unknown as LogLevel;
      }
      i++;
    }
  }

  return options;
}

/**
 * Wraps SOL to wSOL token using absolute lamport values
 *
 * @param lamports Amount of lamports to wrap (absolute value)
 * @param options Command line options
 * @param logger Structured logger
 * @param connection Solana connection
 * @param walletKeypair Wallet keypair
 * @returns Wrap result with signature and balance information
 */
async function wrapSolToToken(
  lamports: string | number | bigint,
  options: WrapSolOptions,
  logger: any,
  connection: any,
  walletKeypair: any
): Promise<WrapSolResult> {
  // Convert lamports to BigInt to handle large numbers safely
  const lamportsBigInt = BigInt(lamports);

  // Convert to SOL for display purposes only
  const solAmount = Number(lamportsBigInt) / LAMPORTS_PER_SOL;

  logger.info(
    `Wrapping ${lamportsBigInt.toString()} lamports (${solAmount.toFixed(
      9
    )} SOL) to wSOL...`
  );

  // Check SOL balance
  const solBalance = await connection.getBalance(walletKeypair.publicKey);
  const solBalanceDisplay = solBalance / LAMPORTS_PER_SOL;
  logger.info(
    `Current SOL Balance: ${solBalance} lamports (${solBalanceDisplay.toFixed(
      9
    )} SOL)`
  );

  if (solBalance < Number(lamportsBigInt)) {
    throw new Error(
      `Not enough SOL. Need at least ${lamportsBigInt.toString()} lamports, but you have ${solBalance} lamports.`
    );
  }

  // Get the associated token account for native SOL
  const wsolAccount = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    walletKeypair.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  logger.info(`wSOL Account: ${wsolAccount.toString()}`);

  // Check if the token account exists
  const accountInfo = await connection.getAccountInfo(wsolAccount);

  if (!accountInfo) {
    throw new Error("Token account does not exist. Cannot wrap SOL.");
  }

  // Show current wSOL balance before wrapping
  try {
    const currentWsolBalance = await connection.getTokenAccountBalance(
      wsolAccount
    );
    logger.info(
      `Current wSOL balance: ${currentWsolBalance.value.amount} lamports`
    );
  } catch (error) {
    logger.debug("Could not fetch current wSOL balance");
  }

  logger.info("wSOL account exists. Proceeding with wrapping...");

  // Get a recent blockhash with longer validity
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
    commitment: "finalized"
  });

  // Create a transaction to transfer SOL and sync native
  const transaction = new Transaction({
    feePayer: walletKeypair.publicKey,
    blockhash,
    lastValidBlockHeight
  })
    .add(
      // Transfer SOL to the associated token account
      SystemProgram.transfer({
        fromPubkey: walletKeypair.publicKey,
        toPubkey: wsolAccount,
        lamports: Number(lamportsBigInt),
      })
    )
    .add(
      // Sync native instruction to update token account balance
      createSyncNativeInstruction(wsolAccount)
    );

  // Send the transaction
  logger.info("Sending transaction...");
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [walletKeypair],
    { 
      skipPreflight: options.skipPreflight, 
      commitment: "confirmed",
      maxRetries: 5,
      preflightCommitment: "processed"
    }
  );

  // Get updated wSOL balance
  const tokenInfo = await connection.getTokenAccountBalance(wsolAccount);

  // Show the results in absolute lamport values
  logger.info(`✅ Transaction successful!`);
  logger.info(`SOL wrapped to wSOL: ${lamportsBigInt.toString()} lamports`);
  logger.info(
    `New wSOL balance: ${tokenInfo.value.amount} lamports (${tokenInfo.value.uiAmountString} ${WRAP_SOL_CONFIG.tokenDescription})`
  );

  return {
    signature,
    amountWrapped: lamportsBigInt,
    newWsolBalance: tokenInfo.value.amount,
  };
}

/**
 * Main entry point for SOL wrapping
 */
async function wrapSolEntrypoint(): Promise<void> {
  try {
    // Parse command line arguments
    const cmdOptions = parseWrapSolArgs();

    // Create logger with appropriate level
    const logger = createLogger("wrap-sol", {
      level: cmdOptions.logLevel ?? LogLevel.INFO,
    });

    // Display environment information
    logger.info("\n==== Environment Information ====");
    logger.info(`Solana Cluster: ${cmdOptions.network || "devnet"}`);

    // Get appropriate keypair path
    const keypairPath = getKeypairPath(cmdOptions);
    logger.info(`Keypair Path: ${keypairPath}`);

    // Load wallet keypair
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Config is already defined at the top of the file
    const connection = config.connection;

    // Check wallet SOL balance
    logger.info("\n==== Wallet Balance Information ====");
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    logger.info(
      `SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`
    );

    // Get amount to wrap in lamports (using default or command line value)
    // Check if a custom amount was specified on the command line
    const lamports = process.argv.includes("--amount")
      ? cmdOptions.amount
      : WRAP_SOL_CONFIG.defaultAmount;

    logger.info(
      `\nYou are about to wrap ${lamports} lamports to ${WRAP_SOL_CONFIG.tokenDescription}`
    );
    logger.info(
      `This operation will convert native SOL to SPL token format required for token operations.`
    );

    // Process SOL wrapping
    logger.info("\n==== Wrapping SOL to wSOL ====");
    const result = await wrapSolToToken(
      lamports,
      cmdOptions,
      logger,
      connection,
      walletKeypair
    );

    // Display transaction details
    logger.info("\n==== Transaction Details ====");
    logger.info(`Transaction signature: ${result.signature}`);
    logger.info(
      `Explorer URL: https://explorer.solana.com/tx/${
        result.signature
      }?cluster=${cmdOptions.network || "devnet"}`
    );

    // Show a summary in absolute values
    logger.info("\n==== Operation Summary ====");
    logger.info(`Token: ${WRAP_SOL_CONFIG.tokenDescription}`);
    logger.info(`Amount Wrapped: ${result.amountWrapped.toString()} lamports`);
    logger.info(`New Balance: ${result.newWsolBalance} lamports`);

    logger.info("\nSOL wrapping completed successfully");
  } catch (error) {
    console.error(
      `❌ Failed to wrap SOL:`,
      error instanceof Error ? error.message : String(error)
    );

    if (error instanceof Error && error.stack) {
      console.debug("Error stack:");
      console.debug(error.stack);
    }

    printUsage("token:wrap");
  }
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("token:wrap");
  process.exit(0);
}

// Run the script if it's executed directly
if (require.main === module) {
  wrapSolEntrypoint().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
