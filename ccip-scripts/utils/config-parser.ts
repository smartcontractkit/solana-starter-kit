import { LogLevel } from "../../ccip-sdk";
import { resolve } from "path";

/**
 * Default keypair paths
 */
export const KEYPAIR_PATHS = {
  /** Default Solana CLI keypair location */
  DEFAULT: resolve(process.env.HOME || "", ".config/solana/id.json"),
  /** Test keypair for development/testing */
  TEST: resolve(process.env.HOME || "", ".config/solana/keytest.json"),
};

/**
 * Fee token types supported by the CCIP scripts
 */
export enum FeeTokenType {
  NATIVE = 'native',
  WRAPPED_NATIVE = 'wrapped-native',
  LINK = 'link'
}

/**
 * Common CLI options shared across scripts
 */
export interface CommonOptions {
  /** Log level for SDK operations */
  logLevel?: LogLevel;
  /** Network to use (devnet or mainnet) */
  network?: "devnet" | "mainnet";
  /** Path to keypair file */
  keypairPath?: string;
  /** Use test keypair instead of default */
  useTestKeypair?: boolean;
  /** Skip transaction preflight checks */
  skipPreflight?: boolean;
}

/**
 * Options for CCIP send operations
 */
export interface CCIPSendOptions extends CommonOptions {
  /** Type of token to use for fees */
  feeToken?: FeeTokenType | string;
}

/**
 * Options for token operations
 */
export interface TokenOptions extends CommonOptions {
  /** Amount to use for token operations */
  amount?: number;
}

/**
 * Parse common command line arguments
 * @returns Parsed options
 */
export function parseCommonArgs(): CommonOptions {
  const args = process.argv.slice(2);
  const options: CommonOptions = {
    network: "devnet",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--log-level" && i + 1 < args.length) {
      const level = args[i + 1].toUpperCase();
      switch (level) {
        case "TRACE": options.logLevel = LogLevel.TRACE; break;
        case "DEBUG": options.logLevel = LogLevel.DEBUG; break;
        case "INFO": options.logLevel = LogLevel.INFO; break;
        case "WARN": options.logLevel = LogLevel.WARN; break;
        case "ERROR": options.logLevel = LogLevel.ERROR; break;
        case "SILENT": options.logLevel = LogLevel.SILENT; break;
        default:
          console.warn(`Unknown log level: ${level}, using INFO`);
          options.logLevel = LogLevel.INFO;
      }
      i++; // Skip the next argument
    } else if (args[i] === "--network" && i + 1 < args.length) {
      const network = args[i + 1].toLowerCase();
      if (network === "devnet" || network === "mainnet") {
        options.network = network;
      } else {
        console.warn(`Unknown network: ${network}, using devnet`);
      }
      i++;
    } else if (args[i] === "--keypair" && i + 1 < args.length) {
      options.keypairPath = args[i + 1];
      i++;
    } else if (args[i] === "--use-test-keypair") {
      options.useTestKeypair = true;
    } else if (args[i] === "--skip-preflight") {
      options.skipPreflight = true;
    }
  }

  return options;
}

/**
 * Get the appropriate keypair path based on options
 * @param options Options containing keypair preferences
 * @returns The keypair path to use
 */
export function getKeypairPath(options: CommonOptions): string {
  // Explicit path takes precedence
  if (options.keypairPath) {
    return options.keypairPath;
  }
  
  // If test keypair is explicitly requested, use it
  if (options.useTestKeypair) {
    return KEYPAIR_PATHS.TEST;
  }
  
  // Otherwise use the default keypair
  return KEYPAIR_PATHS.DEFAULT;
}

/**
 * Parse command line arguments for CCIP send operations
 * @returns Parsed CCIP send options
 */
export function parseCCIPSendArgs(): CCIPSendOptions {
  const options = parseCommonArgs();
  const args = process.argv.slice(2);
  const sendOptions: CCIPSendOptions = {
    ...options,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fee-token" && i + 1 < args.length) {
      const tokenValue = args[i + 1].toLowerCase();
      
      // Check if it's a recognized enum value
      if (Object.values(FeeTokenType).includes(tokenValue as FeeTokenType)) {
        sendOptions.feeToken = tokenValue as FeeTokenType;
      } else {
        // Could be a custom address
        sendOptions.feeToken = args[i + 1];
      }
      i++;
    }
  }

  return sendOptions;
}

/**
 * Parse command line arguments for token operations
 * @returns Parsed token options
 */
export function parseTokenArgs(): TokenOptions {
  const options = parseCommonArgs();
  const args = process.argv.slice(2);
  const tokenOptions: TokenOptions = {
    ...options,
    amount: 1, // Default amount
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--amount" && i + 1 < args.length) {
      const amount = parseFloat(args[i + 1]);
      if (!isNaN(amount)) {
        tokenOptions.amount = amount;
      } else {
        console.warn(`Invalid amount: ${args[i + 1]}, using default 1`);
      }
      i++;
    }
  }

  return tokenOptions;
}

/**
 * Print standard usage information for CCIP scripts
 * @param scriptName Name of the script for customized help
 */
export function printUsage(scriptName: string): void {
  console.log(`\nUsage: npm run ${scriptName} [options]\n`);
  console.log("Common Options:");
  console.log("  --network <devnet|mainnet>    Specify network (default: devnet)");
  console.log("  --keypair <path>              Path to keypair file (default: ~/.config/solana/id.json)");
  console.log("  --use-test-keypair            Use test keypair at ~/.config/solana/keytest.json");
  console.log("  --log-level <level>           Log level: TRACE, DEBUG, INFO, WARN, ERROR, SILENT (default: INFO)");
  console.log("  --skip-preflight              Skip preflight transaction checks");
  
  if (scriptName.startsWith('ccip:send')) {
    console.log("\nCCIP Send Options:");
    console.log("  --fee-token <token>           Fee token type: native, wrapped-native, link, or custom address");
  }
  
  if (scriptName.startsWith('token:')) {
    console.log("\nToken Options:");
    console.log("  --amount <number>             Amount to use for token operation (default: 1)");
  }
  
  console.log("");
} 