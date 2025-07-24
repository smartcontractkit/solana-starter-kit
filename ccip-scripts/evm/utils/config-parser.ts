import { LogLevel, parseLogLevel } from "../../../ccip-lib/evm";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { ChainId } from "../../config";

// Define an interface for our enhanced dotenv result
interface EnvLoadResult {
  path?: string;
  result: dotenv.DotenvConfigOutput;
}

/**
 * Load environment variables from multiple possible locations
 * Tries to find .env file in different directories to ensure it's loaded properly
 */
const loadEnvFile = (): EnvLoadResult => {
  // Potential locations for .env file
  const potentialPaths = [
    // Current directory
    path.resolve(process.cwd(), ".env"),

    // Parent directory (ccip-scripts)
    path.resolve(process.cwd(), "..", ".env"),

    // Project root (2 levels up)
    path.resolve(process.cwd(), "../..", ".env"),

    // Absolute project root (determined from package.json location)
    path.resolve(__dirname, "../../../.env"),
  ];

  // Log the current working directory for debugging
  console.log(`Current working directory: ${process.cwd()}`);

  // Try each path until one works
  for (const envPath of potentialPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`Found .env file at: ${envPath}`);
      const result = dotenv.config({ path: envPath });

      if (!result.error) {
        return { path: envPath, result };
      } else {
        console.warn(`Error loading ${envPath}:`, result.error);
      }
    }
  }

  // If we got here, no valid .env file was found
  console.warn(
    "No valid .env file found in any expected location. Paths checked:"
  );
  potentialPaths.forEach((p) =>
    console.log(`- ${p} (${fs.existsSync(p) ? "exists" : "not found"})`)
  );

  // Load with default behavior as fallback
  return { result: dotenv.config() };
};

// Load environment variables
const envResult = loadEnvFile();
if (envResult.path) {
  console.log(
    `Successfully loaded environment variables from ${envResult.path}`
  );
} else {
  console.warn("Using default environment variables (if any)");
}

// Check if critical environment variables are available
if (!process.env.EVM_PRIVATE_KEY) {
  console.warn("Warning: EVM_PRIVATE_KEY not found in environment variables");
}

/**
 * Common options for EVM scripts
 */
export interface CommonOptions {
  /** Private key for signing transactions */
  privateKey?: string;

  /** Log level for output */
  logLevel?: LogLevel;

  /** Fee token to use for CCIP fees */
  feeToken?: string;

  /** Array of token amounts to transfer */
  tokenAmounts?: Array<{ token: string; amount: string }>;

  /** Token address to use for transfer */
  token?: string;

  /** Amount to transfer */
  amount?: string;

  /** Receiver address on Solana for the CCIP message */
  receiver?: string;

  /** Token receiver address on Solana (where tokens will be sent) */
  tokenReceiver?: string;

  /** Custom message data */
  data?: string;

  /** Compute units for Solana execution */
  computeUnits?: number;

  /** Additional Solana accounts */
  accounts?: string[];

  /** Bitmap of accounts that should be made writeable */
  accountIsWritableBitmap?: string | bigint;

  /** Source chain ID to use for the transaction */
  chainId?: ChainId;
}

/**
 * Parse common command line arguments
 *
 * @returns Parsed options
 */
export function parseCommonArgs(): CommonOptions {
  const args = process.argv.slice(2);
  const options: CommonOptions = {
    privateKey: process.env.EVM_PRIVATE_KEY,
    logLevel: LogLevel.INFO,
  };

  // Parse private key
  if (!options.privateKey) {
    options.privateKey = process.env.EVM_PRIVATE_KEY;
    if (!options.privateKey) {
      console.warn("Warning: EVM_PRIVATE_KEY not found in .env file.");
      throw new Error("EVM_PRIVATE_KEY must be set in your .env file");
    }
  }

  // Parse fee token
  const feeTokenIndex = args.indexOf("--fee-token");
  if (feeTokenIndex >= 0 && args.length > feeTokenIndex + 1) {
    options.feeToken = args[feeTokenIndex + 1];
  }

  // Parse tokenAmounts
  const tokenAmountsIndex = args.indexOf("--token-amounts");
  if (tokenAmountsIndex >= 0 && args.length > tokenAmountsIndex + 1) {
    try {
      // Format is expected to be: token1:amount1,token2:amount2,...
      const tokenAmountsStr = args[tokenAmountsIndex + 1];
      const tokenAmounts = tokenAmountsStr.split(",").map((pair) => {
        const [token, amount] = pair.split(":");
        if (!token || !amount) {
          throw new Error(
            `Invalid token-amount pair format: ${pair}. Expected format: token:amount`
          );
        }
        return { token, amount };
      });

      if (tokenAmounts.length > 0) {
        options.tokenAmounts = tokenAmounts;
      }
    } catch (error) {
      console.warn(
        `Warning: Failed to parse --token-amounts. Format should be token1:amount1,token2:amount2,...`
      );
      if (error instanceof Error) {
        console.warn(error.message);
      }
    }
  }

  // Parse token
  const tokenIndex = args.indexOf("--token");
  if (tokenIndex >= 0 && args.length > tokenIndex + 1) {
    options.token = args[tokenIndex + 1];
  }

  // Parse amount
  const amountIndex = args.indexOf("--amount");
  if (amountIndex >= 0 && args.length > amountIndex + 1) {
    options.amount = args[amountIndex + 1];
  }

  // If --token and --amount are provided but no --token-amounts,
  // create tokenAmounts from these values
  if (options.token && options.amount && !options.tokenAmounts) {
    options.tokenAmounts = [{ token: options.token, amount: options.amount }];
  }

  // Handle partial token override: if --token is provided but no --amount,
  // create tokenAmounts using the custom token with a default amount
  if (options.token && !options.amount && !options.tokenAmounts) {
    const defaultAmount = "10000000000000000"; // 0.01 token with 18 decimals (matches default config)
    options.tokenAmounts = [{ token: options.token, amount: defaultAmount }];
  }

  // Parse receiver (CCIP message receiver)
  const receiverIndex = args.indexOf("--receiver");
  if (receiverIndex >= 0 && args.length > receiverIndex + 1) {
    options.receiver = args[receiverIndex + 1];
  }

  // Parse token receiver (Solana wallet to receive tokens)
  const tokenReceiverIndex = args.indexOf("--token-receiver");
  if (tokenReceiverIndex >= 0 && args.length > tokenReceiverIndex + 1) {
    options.tokenReceiver = args[tokenReceiverIndex + 1];
  }

  // Parse data
  const dataIndex = args.indexOf("--data");
  if (dataIndex >= 0 && args.length > dataIndex + 1) {
    const data = args[dataIndex + 1];
    // Handle hex and string data
    options.data = data.startsWith("0x")
      ? data
      : "0x" + Buffer.from(data).toString("hex");
  }

  // Parse compute units
  const computeUnitsIndex = args.indexOf("--compute-units");
  if (computeUnitsIndex >= 0 && args.length > computeUnitsIndex + 1) {
    options.computeUnits = parseInt(args[computeUnitsIndex + 1], 10);
  }

  // Parse accounts (comma-separated list)
  const accountsIndex = args.indexOf("--accounts");
  if (accountsIndex >= 0 && args.length > accountsIndex + 1) {
    options.accounts = args[accountsIndex + 1].split(",");
  }

  // Parse accountIsWritableBitmap
  const bitmapIndex = args.indexOf("--account-is-writable-bitmap");
  if (bitmapIndex >= 0 && args.length > bitmapIndex + 1) {
    options.accountIsWritableBitmap = args[bitmapIndex + 1];
  }

  // Parse log level
  const logLevelIndex = args.indexOf("--log-level");
  if (logLevelIndex >= 0 && args.length > logLevelIndex + 1) {
    options.logLevel = parseLogLevel(args[logLevelIndex + 1], LogLevel.INFO);
  }

  // Parse chain ID
  const chainIdIndex = args.indexOf("--chain-id");
  if (chainIdIndex >= 0 && args.length > chainIdIndex + 1) {
    const chainIdValue = args[chainIdIndex + 1];
    // Check if this is a valid chain ID in our enum
    if (Object.values(ChainId).includes(chainIdValue as ChainId)) {
      options.chainId = chainIdValue as ChainId;
    } else {
      console.warn(
        `Warning: Unknown chain ID "${chainIdValue}". Using default chain.`
      );
    }
  }

  return options;
}

