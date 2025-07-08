/**
 * SPL Token-2022 Minting Script
 *
 * This script mints tokens to a specified recipient's associated token account.
 * If the associated token account (ATA) doesn't exist, it will be created automatically.
 * This script works with any SPL Token-2022 mint that you have minting authority for.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.005 SOL)
 * 2. You must be the mint authority of the token you want to mint
 * 3. Run the script with: yarn svm:token:mint
 *
 * You can override settings with command line arguments:
 * --mint <address>     : Token mint address (required)
 * --amount <number>    : Amount to mint in token units (required)
 * --recipient <address>: Recipient wallet address (optional, defaults to your wallet)
 * --keypair <path>     : Path to your keypair file
 * --log-level <level>  : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight     : Skip transaction preflight checks
 *
 * Examples:
 * # Mint tokens to your own wallet
 * yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 1000
 *
 * # Mint tokens to another wallet
 * yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 1000 --recipient 5vXXX...
 *
 * # Mint with custom settings
 * yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 1000 --log-level DEBUG --skip-preflight
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TokenManager,
  TokenManagerOptions,
  LogLevel,
  createLogger,
} from "../../../ccip-lib/svm";
import {
  loadKeypair,
  parseTokenArgs,
  printUsage,
  getKeypairPath,
} from "../utils";
import {
  ChainId,
  getCCIPSVMConfig,
  getExplorerUrl,
  getExplorerAddressUrl,
} from "../../config";

// Get configuration
const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

// =================================================================
// TOKEN MINTING CONFIGURATION
// Default parameters for token minting
// =================================================================
const TOKEN_MINTING_CONFIG = {
  // Requirements
  minSolRequired: 0.005, // Minimum SOL needed for transaction fees

  // Default values
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Extended options for token minting operations
 */
interface MintTokenOptions extends ReturnType<typeof parseTokenArgs> {
  mint?: string;
  amount?: string;
  recipient?: string;
  logLevel?: LogLevel;
}

/**
 * Parse command line arguments for token minting
 */
function parseMintTokenArgs(): MintTokenOptions {
  const tokenOptions = parseTokenArgs();
  const args = process.argv.slice(2);
  const options: MintTokenOptions = {
    ...tokenOptions,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--mint":
        if (i + 1 < args.length) {
          options.mint = args[i + 1];
          i++;
        }
        break;
      case "--amount":
        if (i + 1 < args.length) {
          options.amount = args[i + 1];
          i++;
        }
        break;
      case "--recipient":
        if (i + 1 < args.length) {
          options.recipient = args[i + 1];
          i++;
        }
        break;
      case "--log-level":
        if (i + 1 < args.length) {
          const level = args[i + 1].toUpperCase();
          switch (level) {
            case "TRACE":
              options.logLevel = LogLevel.TRACE;
              break;
            case "DEBUG":
              options.logLevel = LogLevel.DEBUG;
              break;
            case "INFO":
              options.logLevel = LogLevel.INFO;
              break;
            case "WARN":
              options.logLevel = LogLevel.WARN;
              break;
            case "ERROR":
              options.logLevel = LogLevel.ERROR;
              break;
            case "SILENT":
              options.logLevel = LogLevel.SILENT;
              break;
            default:
              console.warn(`Unknown log level: ${level}, using INFO`);
              options.logLevel = LogLevel.INFO;
          }
          i++;
        }
        break;
    }
  }

  return options;
}

/**
 * Validate token minting configuration
 */
function validateMintTokenConfig(options: MintTokenOptions): void {
  const errors: string[] = [];

  if (!options.mint) {
    errors.push("Token mint address is required (use --mint)");
  } else {
    try {
      new PublicKey(options.mint);
    } catch {
      errors.push("Invalid mint address format");
    }
  }

  if (!options.amount) {
    errors.push("Amount to mint is required (use --amount)");
  } else {
    const amount = parseFloat(options.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push("Amount must be a positive number");
    }
  }

  if (options.recipient) {
    try {
      new PublicKey(options.recipient);
    } catch {
      errors.push("Invalid recipient address format");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors
        .map((e) => `  - ${e}`)
        .join("\n")}`
    );
  }
}

/**
 * Get token information from mint address
 */
async function getTokenInfo(mint: PublicKey): Promise<{
  decimals: number;
  supply: string;
}> {
  try {
    const mintInfo = await config.connection.getParsedAccountInfo(mint);

    if (
      !mintInfo.value ||
      !mintInfo.value.data ||
      typeof mintInfo.value.data === "string"
    ) {
      throw new Error("Invalid mint account or unable to parse mint data");
    }

    const data = mintInfo.value.data as any;
    if (data.program !== "spl-token-2022" && data.program !== "spl-token") {
      throw new Error("Account is not a valid SPL token mint");
    }

    return {
      decimals: data.parsed.info.decimals,
      supply: data.parsed.info.supply,
    };
  } catch (error) {
    throw new Error(
      `Failed to get token info: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Convert amount from token units to raw token amount
 */
function convertToRawAmount(amount: string, decimals: number): bigint {
  const amountFloat = parseFloat(amount);
  const multiplier = Math.pow(10, decimals);
  const rawAmount = Math.floor(amountFloat * multiplier);
  return BigInt(rawAmount);
}

/**
 * Format raw token amount to human-readable units
 */
function formatTokenAmount(rawAmount: string, decimals: number): string {
  const amount = BigInt(rawAmount);
  const divisor = BigInt(Math.pow(10, decimals));
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  return trimmedFractional
    ? `${wholePart}.${trimmedFractional}`
    : wholePart.toString();
}

/**
 * Main token minting function
 */
async function mintTokensEntrypoint(): Promise<void> {
  try {
    // Parse command line arguments
    const cmdOptions = parseMintTokenArgs();

    // Create logger with appropriate level
    const logger = createLogger("mint-tokens", {
      level: cmdOptions.logLevel ?? TOKEN_MINTING_CONFIG.defaultLogLevel,
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

    // Check wallet SOL balance
    logger.info("\n==== Wallet Balance Information ====");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    logger.info(
      `SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`
    );

    if (solBalanceDisplay < TOKEN_MINTING_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${TOKEN_MINTING_CONFIG.minSolRequired} SOL for transaction fees. ` +
          `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration
    validateMintTokenConfig(cmdOptions);

    const mintAddress = new PublicKey(cmdOptions.mint!);
    const recipientAddress = cmdOptions.recipient
      ? new PublicKey(cmdOptions.recipient)
      : walletKeypair.publicKey;

    // Get token information
    logger.info("\n==== Token Information ====");
    const tokenInfo = await getTokenInfo(mintAddress);
    logger.info(`Mint Address: ${mintAddress.toString()}`);
    logger.info(`Token Decimals: ${tokenInfo.decimals}`);
    logger.info(
      `Current Supply: ${formatTokenAmount(
        tokenInfo.supply,
        tokenInfo.decimals
      )} tokens`
    );

    // Convert amount to raw token amount
    const rawAmount = convertToRawAmount(
      cmdOptions.amount!,
      tokenInfo.decimals
    );
    const formattedAmount = formatTokenAmount(
      rawAmount.toString(),
      tokenInfo.decimals
    );

    logger.info("\n==== Minting Configuration ====");
    logger.info(`Amount to Mint: ${formattedAmount} tokens`);
    logger.info(`Raw Amount: ${rawAmount.toString()}`);
    logger.info(`Recipient: ${recipientAddress.toString()}`);
    if (recipientAddress.equals(walletKeypair.publicKey)) {
      logger.info("(Minting to your own wallet)");
    }

    // Initialize TokenManager
    const tokenManagerOptions: TokenManagerOptions = {
      logLevel: cmdOptions.logLevel ?? TOKEN_MINTING_CONFIG.defaultLogLevel,
      skipPreflight: cmdOptions.skipPreflight,
      commitment: "finalized",
    };

    const tokenManager = new TokenManager(
      config,
      walletKeypair,
      tokenManagerOptions
    );

    // Check if ATA exists and get/create it
    logger.info("\n==== Associated Token Account ====");
    const ata = await tokenManager.getOrCreateATA(
      mintAddress,
      recipientAddress
    );
    logger.info(`Token Account: ${ata.toString()}`);

    // Get current balance before minting
    let currentBalance: bigint;
    try {
      currentBalance = await tokenManager.getTokenBalance(ata);
      logger.info(
        `Current Balance: ${formatTokenAmount(
          currentBalance.toString(),
          tokenInfo.decimals
        )} tokens`
      );
    } catch {
      logger.info("Current Balance: 0 tokens (new account)");
      currentBalance = BigInt(0);
    }

    // Mint the tokens
    logger.info("\n==== Minting Tokens ====");
    const result = await tokenManager.mintTokens(
      mintAddress,
      rawAmount,
      recipientAddress
    );

    // Display results
    logger.info("\n==== Tokens Minted Successfully ====");
    logger.info(`Transaction Signature: ${result.signature}`);
    logger.info(
      `Amount Minted: ${formatTokenAmount(
        result.amount.toString(),
        tokenInfo.decimals
      )} tokens`
    );
    logger.info(
      `New Balance: ${formatTokenAmount(
        result.newBalance,
        tokenInfo.decimals
      )} tokens`
    );
    logger.info(`Token Account: ${result.tokenAccount.toString()}`);

    // Calculate and display the change
    const newBalanceBigInt = BigInt(result.newBalance);
    const balanceIncrease = newBalanceBigInt - currentBalance;
    logger.info(
      `Balance Increase: +${formatTokenAmount(
        balanceIncrease.toString(),
        tokenInfo.decimals
      )} tokens`
    );

    // Display explorer URLs
    logger.info("\n==== Explorer URLs ====");
    logger.info(`Transaction: ${getExplorerUrl(config.id, result.signature)}`);
    logger.info(
      `Token Account: ${getExplorerAddressUrl(
        config.id,
        result.tokenAccount.toString()
      )}`
    );
    logger.info(
      `Mint: ${getExplorerAddressUrl(config.id, mintAddress.toString())}`
    );

    logger.info("\n🎉 Token minting completed successfully!");
  } catch (error) {
    console.error(
      `❌ Failed to mint tokens:`,
      error instanceof Error ? error.message : String(error)
    );

    if (error instanceof Error && error.stack) {
      console.debug("Error stack:");
      console.debug(error.stack);
    }

    printUsage("svm:token:mint");
    process.exit(1);
  }
}

/**
 * Print usage information
 */
function printMintTokenUsage(): void {
  console.log(`
🪙 SPL Token-2022 Minting Tool

Usage: yarn svm:token:mint [options]

Options:
  --mint <address>        Token mint address (required)
  --amount <number>       Amount to mint in token units (required)
  --recipient <address>   Recipient wallet address (optional, defaults to your wallet)
  --keypair <path>        Path to wallet keypair file
  --log-level <level>     Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight        Skip transaction preflight checks
  --help, -h              Show this help message

Examples:
  # Mint 1000 tokens to your wallet
  yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 1000

  # Mint 500 tokens to another wallet
  yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 500 --recipient 5vXXX...

  # Mint with debugging enabled
  yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 100 --log-level DEBUG

Notes:
  - You must be the mint authority of the token to mint new tokens
  - Associated Token Accounts (ATAs) will be created automatically if they don't exist
  - Transaction fees are paid from your wallet's SOL balance
  - Amounts are specified in token units (e.g., 1.5 tokens, not raw amounts)
  `);
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printMintTokenUsage();
  process.exit(0);
}

// Run the script if it's executed directly
if (require.main === module) {
  mintTokensEntrypoint().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
