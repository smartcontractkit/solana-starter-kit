/**
 * SPL Token Creation Script with Metaplex Metadata
 *
 * This script creates a new SPL Token (legacy token program) with Metaplex metadata support.
 * It leverages the TokenManager library for a consistent and robust token creation experience.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. Provide at minimum a token name and symbol
 * 3. Run the script with: yarn svm:token:create-spl
 *
 * ALL arguments are optional with defaults:
 * --name            : Token name (max 32 characters, default: "AEM")
 * --symbol          : Token symbol (max 10 characters, default: "CCIP-AEM")
 * --uri             : Metadata URI (uses sample URI if not provided)
 * --decimals        : Number of decimal places (0-9, default: 9)
 * --initial-supply  : Initial token supply to mint (default: 1,000,000)
 * --fee-basis-points: Seller fee basis points (0-10000, default: 0)
 * --keypair         : Path to your keypair file
 * --log-level       : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight  : Skip transaction preflight checks
 *
 * Example usage:
 * # Minimal (uses all defaults)
 * yarn svm:token:create-spl
 *
 * # With custom name and symbol
 * yarn svm:token:create-spl --name "My Token" --symbol "MTK"
 *
 * # With all custom settings
 * yarn svm:token:create-spl --name "My Token" --symbol "MTK" --uri "https://example.com/metadata.json" --decimals 6 --initial-supply 5000000
 */

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TokenCreationUtils,
  SplTokenConfig,
  TokenProgram,
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
// TOKEN CREATION CONFIGURATION
// Default parameters for SPL token creation
// =================================================================
const TOKEN_CREATION_CONFIG = {
  // Default values
  defaultName: "AEM",
  defaultSymbol: "CCIP-AEM",
  defaultDecimals: 9,
  defaultSellerFeeBasisPoints: 0,
  defaultInitialSupply: "1000000000000", // Default initial supply (10^12 tokens)
  defaultLogLevel: LogLevel.INFO,

  // Requirements
  minSolRequired: 0.01, // Minimum SOL needed for transaction fees

  // Default metadata URI (users should override this)
  defaultMetadataUri:
    "https://cyan-pleasant-anteater-613.mypinata.cloud/ipfs/bafkreieirlwjqbtzniqsgcjebzexlcspcmvd4woh3ajvf2p4fuivkenw6i",
};

/**
 * Extended options for token creation operations
 */
interface CreateTokenOptions extends ReturnType<typeof parseTokenArgs> {
  name?: string;
  symbol?: string;
  uri?: string;
  decimals?: number;
  initialSupply?: string;
  feeBasisPoints?: number;
  logLevel?: LogLevel;
}

/**
 * Parse command line arguments for token creation
 */
function parseCreateTokenArgs(): CreateTokenOptions {
  const tokenOptions = parseTokenArgs();
  const args = process.argv.slice(2);
  const options: CreateTokenOptions = {
    ...tokenOptions,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--name":
        if (i + 1 < args.length) {
          options.name = args[i + 1];
          i++;
        }
        break;
      case "--symbol":
        if (i + 1 < args.length) {
          options.symbol = args[i + 1];
          i++;
        }
        break;
      case "--uri":
        if (i + 1 < args.length) {
          options.uri = args[i + 1];
          i++;
        }
        break;
      case "--decimals":
        if (i + 1 < args.length) {
          const decimals = parseInt(args[i + 1]);
          if (!isNaN(decimals) && decimals >= 0 && decimals <= 9) {
            options.decimals = decimals;
          }
          i++;
        }
        break;
      case "--initial-supply":
        if (i + 1 < args.length) {
          options.initialSupply = args[i + 1];
          i++;
        }
        break;
      case "--fee-basis-points":
        if (i + 1 < args.length) {
          const points = parseInt(args[i + 1]);
          if (!isNaN(points) && points >= 0 && points <= 10000) {
            options.feeBasisPoints = points;
          }
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
 * Validate token creation configuration
 */
function validateCreateTokenConfig(options: CreateTokenOptions): void {
  const errors: string[] = [];

  if (options.name && options.name.length > 32) {
    errors.push("Token name must be 32 characters or less");
  }

  if (options.symbol && options.symbol.length > 10) {
    errors.push("Token symbol must be 10 characters or less");
  }

  if (
    options.decimals !== undefined &&
    (options.decimals < 0 || options.decimals > 9)
  ) {
    errors.push("Decimals must be between 0 and 9");
  }

  if (
    options.feeBasisPoints !== undefined &&
    (options.feeBasisPoints < 0 || options.feeBasisPoints > 10000)
  ) {
    errors.push("Fee basis points must be between 0 and 10000");
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
 * Create token configuration from command line options
 */
function createTokenConfigFromOptions(
  options: CreateTokenOptions
): SplTokenConfig {
  // Use provided values or fall back to defaults
  const name = options.name || TOKEN_CREATION_CONFIG.defaultName;
  const symbol = options.symbol || TOKEN_CREATION_CONFIG.defaultSymbol;
  const uri = options.uri || TOKEN_CREATION_CONFIG.defaultMetadataUri;

  // Use provided initial supply or fall back to default
  const initialSupply = options.initialSupply
    ? BigInt(options.initialSupply)
    : BigInt(TOKEN_CREATION_CONFIG.defaultInitialSupply);

  return {
    name: name,
    symbol: symbol,
    uri: uri,
    decimals: options.decimals ?? TOKEN_CREATION_CONFIG.defaultDecimals,
    initialSupply: initialSupply,
    sellerFeeBasisPoints:
      options.feeBasisPoints ??
      TOKEN_CREATION_CONFIG.defaultSellerFeeBasisPoints,
    tokenProgram: TokenProgram.SPL_TOKEN,
  };
}

/**
 * Main SPL token creation function
 */
async function createSplTokenEntrypoint(): Promise<void> {
  try {
    // Parse command line arguments
    const cmdOptions = parseCreateTokenArgs();

    // Create logger with appropriate level
    const logger = createLogger("create-spl-token", {
      level: cmdOptions.logLevel ?? TOKEN_CREATION_CONFIG.defaultLogLevel,
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

    if (solBalanceDisplay < TOKEN_CREATION_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${TOKEN_CREATION_CONFIG.minSolRequired} SOL for transaction fees. ` +
          `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration
    validateCreateTokenConfig(cmdOptions);

    // Create token configuration
    const tokenConfig = createTokenConfigFromOptions(cmdOptions);

    logger.info("\n==== SPL Token Configuration ====");
    logger.info(
      `Name: ${tokenConfig.name}${!cmdOptions.name ? " (default)" : ""}`
    );
    logger.info(
      `Symbol: ${tokenConfig.symbol}${!cmdOptions.symbol ? " (default)" : ""}`
    );
    logger.info(
      `Decimals: ${tokenConfig.decimals}${
        cmdOptions.decimals === undefined ? " (default)" : ""
      }`
    );
    logger.info(
      `URI: ${tokenConfig.uri}${!cmdOptions.uri ? " (default)" : ""}`
    );
    logger.info(
      `Initial Supply: ${tokenConfig.initialSupply?.toString() || "0"}${
        !cmdOptions.initialSupply ? " (default)" : ""
      }`
    );
    logger.info(
      `Seller Fee Basis Points: ${tokenConfig.sellerFeeBasisPoints || 0}${
        cmdOptions.feeBasisPoints === undefined ? " (default)" : ""
      }`
    );

    // Warn if using defaults
    if (!cmdOptions.name || !cmdOptions.symbol) {
      logger.warn(
        "\n⚠️  Using default token name/symbol. Consider providing your own with --name and --symbol for production tokens."
      );
    }
    if (!cmdOptions.uri) {
      logger.warn(
        "\n⚠️  Using default metadata URI. Consider providing your own with --uri for production tokens."
      );
    }

    // Initialize TokenCreationUtils
    const tokenUtils = new TokenCreationUtils(
      config.connection,
      walletKeypair,
      cmdOptions.logLevel ?? TOKEN_CREATION_CONFIG.defaultLogLevel
    );

    // Create the SPL token
    logger.info("\n==== Creating SPL Token ====");
    const result = await tokenUtils.createTokenWithMetadata(tokenConfig, {
      skipPreflight: cmdOptions.skipPreflight,
      commitment: "finalized",
    });

    // Display results
    logger.info("\n==== SPL Token Created Successfully ====");
    logger.info(`Mint Address: ${result.mint.toString()}`);
    logger.info(`Transaction Signature: ${result.signature}`);
    if (result.tokenAccount) {
      logger.info(`Token Account: ${result.tokenAccount.toString()}`);
    }

    // Display explorer URLs
    logger.info("\n==== Explorer URLs ====");
    logger.info(
      `Mint: ${getExplorerAddressUrl(config.id, result.mint.toString())}`
    );
    logger.info(`Transaction: ${getExplorerUrl(config.id, result.signature)}`);
    if (result.tokenAccount) {
      logger.info(
        `Token Account: ${getExplorerAddressUrl(
          config.id,
          result.tokenAccount.toString()
        )}`
      );
    }

    logger.info("\n🎉 SPL Token creation completed successfully!");
    logger.info("\n💡 You can now use this mint address for token operations:");
    logger.info(`   Mint Address: ${result.mint.toString()}`);
  } catch (error) {
    console.error(
      `❌ Failed to create SPL token:`,
      error instanceof Error ? error.message : String(error)
    );

    if (error instanceof Error && error.stack) {
      console.debug("Error stack:");
      console.debug(error.stack);
    }

    printUsage("svm:token:create-spl");
    process.exit(1);
  }
}

/**
 * Print usage information
 */
function printCreateSplTokenUsage(): void {
  console.log(`
🪙 SPL Token Creator with Metadata

Usage: yarn svm:token:create-spl [options]

Options:
  --name <string>              Token name (max 32 characters, default: "${TOKEN_CREATION_CONFIG.defaultName}")
  --symbol <string>            Token symbol (max 10 characters, default: "${TOKEN_CREATION_CONFIG.defaultSymbol}")
  --uri <string>               Metadata URI (default: sample URI - override recommended)
  --decimals <number>          Number of decimal places (0-9, default: ${TOKEN_CREATION_CONFIG.defaultDecimals})
  --initial-supply <number>    Initial token supply to mint (default: ${TOKEN_CREATION_CONFIG.defaultInitialSupply})
  --fee-basis-points <number>  Seller fee basis points (0-10000, default: ${TOKEN_CREATION_CONFIG.defaultSellerFeeBasisPoints})

  --keypair <path>             Path to wallet keypair file
  --log-level <level>          Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight             Skip transaction preflight checks
  --help, -h                   Show this help message

Examples:
  # Minimal SPL token creation (uses all defaults)
  yarn svm:token:create-spl

  # SPL token with custom name and symbol
  yarn svm:token:create-spl --name "My Token" --symbol "MTK"

  # SPL token with custom metadata and supply
  yarn svm:token:create-spl --name "My Token" --symbol "MTK" --uri "https://example.com/metadata.json" --initial-supply 5000000

Note: This creates a legacy SPL Token (not Token-2022). Use create-token-2022.ts for Token-2022 tokens.
  `);
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printCreateSplTokenUsage();
  process.exit(0);
}

// Run the script if it's executed directly
if (require.main === module) {
  createSplTokenEntrypoint().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
