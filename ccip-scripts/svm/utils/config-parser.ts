import { LogLevel } from "../../../ccip-lib/svm";
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
  NATIVE = "native",
  WRAPPED_NATIVE = "wrapped-native",
  LINK = "link",
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
  
  /** Token mint address for CCIP token transfer (legacy single token support) */
  tokenMint?: string;
  
  /** Token amount for CCIP token transfer (legacy single token support) */
  tokenAmount?: string | number;
  
  /** Multiple token transfers support - internal usage */
  tokenAmounts?: Array<{ tokenMint: string, amount: string | number }>;
}

/**
 * Options for token operations
 */
export interface TokenOptions extends CommonOptions {
  /** Amount to use for token operations (as string to preserve precision) */
  amount?: string;
}

/**
 * Parse common command line arguments shared across all CCIP scripts
 * 
 * Extracts standard CLI arguments that are used by most scripts including
 * network selection, keypair path, logging level, and preflight settings.
 * This provides a consistent interface across all CCIP scripts.
 * 
 * @returns Parsed common options with defaults applied
 * 
 * @example
 * ```typescript
 * // Command: yarn script --network devnet --log-level DEBUG --skip-preflight
 * const options = parseCommonArgs();
 * // options.network === "devnet"
 * // options.logLevel === LogLevel.DEBUG
 * // options.skipPreflight === true
 * ```
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
 * 
 * Determines which keypair file to use based on the provided options,
 * following a priority order:
 * 1. Explicit keypair path (--keypair)
 * 2. Test keypair if requested (--use-test-keypair)
 * 3. Default Solana CLI keypair location
 * 
 * This function is essential for beginners as it handles the complexity
 * of keypair selection automatically.
 * 
 * @param options Options containing keypair preferences
 * @returns The resolved absolute path to the keypair file to use
 * 
 * @example
 * ```typescript
 * // With --keypair /custom/path.json
 * const path1 = getKeypairPath({ keypairPath: "/custom/path.json" });
 * // Returns: "/custom/path.json"
 * 
 * // With --use-test-keypair
 * const path2 = getKeypairPath({ useTestKeypair: true });
 * // Returns: "~/.config/solana/keytest.json"
 * 
 * // Default case
 * const path3 = getKeypairPath({});
 * // Returns: "~/.config/solana/id.json"
 * ```
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
 * 
 * Extends common arguments with CCIP-specific parameters like fee token selection.
 * This function is used by scripts that perform cross-chain operations and need
 * to specify how transaction fees should be paid.
 * 
 * @returns Parsed CCIP send options including fee token configuration
 * 
 * @example
 * ```typescript
 * // Command: yarn ccip:send --fee-token native --log-level INFO
 * const options = parseCCIPSendArgs();
 * // options.feeToken === FeeTokenType.NATIVE
 * // options.logLevel === LogLevel.INFO
 * ```
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
 * 
 * Extends common arguments with token-specific parameters like amount.
 * Used by scripts that perform token operations like minting, burning,
 * or transferring tokens. Amount is stored as string to preserve precision
 * for large numbers that exceed JavaScript's safe integer limits.
 * 
 * @returns Parsed token options with amount as string for precision
 * 
 * @example
 * ```typescript
 * // Command: yarn token:mint --amount 1000000000000000000
 * const options = parseTokenArgs();
 * // options.amount === "1000000000000000000" (preserved as string)
 * ```
 */
export function parseTokenArgs(): TokenOptions {
  const options = parseCommonArgs();
  const args = process.argv.slice(2);
  const tokenOptions: TokenOptions = {
    ...options,
    amount: "1", // Default amount as string
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--amount" && i + 1 < args.length) {
      // Store the amount directly as a string to preserve precision
      tokenOptions.amount = args[i + 1];
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
  console.log(`\nUsage: yarn ${scriptName} [options]\n`);
  console.log("Common Options:");
  console.log(
    "  --network <devnet|mainnet>    Specify network (default: devnet)"
  );
  console.log(
    "  --keypair <path>              Path to keypair file (default: ~/.config/solana/id.json)"
  );
  console.log(
    "  --use-test-keypair            Use test keypair at ~/.config/solana/keytest.json"
  );
  console.log(
    "  --log-level <level>           Log level: TRACE, DEBUG, INFO, WARN, ERROR, SILENT (default: INFO)"
  );
  console.log(
    "  --skip-preflight              Skip preflight transaction checks"
  );

  if (scriptName.startsWith("ccip:send") || scriptName.startsWith("svm:token-transfer")) {
    console.log("\nCCIP Send Options:");
    console.log(
      "  --fee-token <token>           Fee token type: native, wrapped-native, link, or custom address"
    );
  }

  if (scriptName === "svm:token-transfer" || scriptName === "ccip:send") {
    console.log("\nToken Transfer Options:");
    console.log(
      "  --token-mint <address>        Token mint address to transfer"
    );
    console.log(
      "  --token-amount <amount>       Amount to transfer in raw units"
    );
    console.log(
      "  For multiple tokens, use comma-separated values:"
    );
    console.log(
      "  --token-mint \"address1,address2\"  Multiple token addresses"
    );
    console.log(
      "  --token-amount \"amount1,amount2\"  Corresponding amounts"
    );
  }

  if (scriptName === "token:delegate") {
    console.log("\nToken Delegation Options:");
    console.log(
      "  --token-mint <address1,address2>  Token mint addresses to delegate (comma-separated)"
    );
    console.log(
      "                                    If provided, replaces default tokens (wSOL, BnM, LINK)"
    );
    console.log(
      "  --token-program-id <address>      Token program ID (default: TOKEN_2022_PROGRAM_ID)"
    );
    console.log(
      "  --delegation-type <type>          Delegation type: fee-billing, token-pool, custom (default: fee-billing)"
    );
    console.log(
      "  --custom-delegate <address>       Custom delegate address (required for custom delegation type)"
    );
    console.log("\nExamples:");
    console.log("  # Delegate single custom token:");
    console.log("  yarn svm:token:delegate --token-mint LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L");
    console.log("  # Delegate multiple custom tokens:");
    console.log("  yarn svm:token:delegate --token-mint \"TokenA...,TokenB...,TokenC...\"");
    console.log("  # Use defaults (wSOL, BnM, LINK):");
    console.log("  yarn svm:token:delegate");
  }

  if (scriptName === "token:check") {
    console.log("\nToken Approval Check Options:");
    console.log(
      "  --token-mint <address1,address2>  Token mint addresses to check (comma-separated)"
    );
    console.log(
      "                                    If provided, replaces default tokens (wSOL, BnM, LINK)"
    );
    console.log(
      "  --delegation-type <type>          Expected delegation type: fee-billing, token-pool, custom (default: fee-billing)"
    );
    console.log(
      "  --custom-delegate <address>       Expected custom delegate address (required for custom delegation type)"
    );
    console.log("\nExamples:");
    console.log("  # Check single custom token:");
    console.log("  yarn svm:token:check --token-mint LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L");
    console.log("  # Check multiple custom tokens:");
    console.log("  yarn svm:token:check --token-mint \"TokenA...,TokenB...,TokenC...\"");
    console.log("  # Check defaults (wSOL, BnM, LINK):");
    console.log("  yarn svm:token:check");
  }

  if (scriptName.startsWith("token:") && scriptName !== "token:delegate" && scriptName !== "token:check") {
    console.log("\nToken Options:");
    console.log(
      "  --amount <number>             Amount to use for token operation (default: 1)"
    );
  }

  console.log("");
}

// Update the TokenTransfer interface to match the types in CCIPSendOptions
export interface TokenTransfer {
  tokenMint: string;
  amount: string | number;
}

export interface CCIPOptions extends CCIPSendOptions {
  tokenAmounts?: TokenTransfer[];
}

/**
 * Parse command line arguments for CCIP scripts with support for
 * both single and multi-token formats
 * 
 * @param scriptType Identifies the type of script for specific argument handling
 * @returns Parsed command line arguments as CCIPOptions
 */
export function parseCCIPArgs(
  scriptType: "token-transfer" | "arbitrary-messaging" | "data-and-tokens"
): CCIPOptions {
  // First get standard arguments as base
  const baseArgs = parseCCIPSendArgs();

  // Create object with appropriate type to avoid TypeScript errors
  const options: CCIPOptions = {
    ...baseArgs,
  };

  const args = process.argv.slice(2);

  // Parse token-specific arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token-mint" && i + 1 < args.length) {
      const mintValue = args[i + 1];

      // Check if comma-separated values
      if (mintValue.includes(",")) {
        const mintValues = mintValue.split(",").map((v) => v.trim());

        // Look for matching token amount argument
        let amountValues: string[] = [];
        for (let j = 0; j < args.length; j++) {
          if (args[j] === "--token-amount" && j + 1 < args.length) {
            const amountValue = args[j + 1];
            if (amountValue.includes(",")) {
              amountValues = amountValue.split(",").map((v) => v.trim());
            } else {
              amountValues = [amountValue];
            }
            break;
          }
        }

        // Create token amounts array
        options.tokenAmounts = mintValues.map((mint, idx) => ({
          tokenMint: mint,
          amount: idx < amountValues.length ? amountValues[idx] : "0",
        }));
      } else {
        options.tokenMint = mintValue;
      }
      i++;
    } else if (args[i] === "--token-amount" && i + 1 < args.length) {
      // Only set if we haven't already processed comma values
      if (!options.tokenAmounts) {
        options.tokenAmount = args[i + 1];
      }
      i++;
    }
  }

  // Check for legacy single token format arguments
  if (options.tokenMint && options.tokenAmount && !options.tokenAmounts) {
    // Convert to token amounts array format
    options.tokenAmounts = [
      {
        tokenMint: options.tokenMint,
        amount: options.tokenAmount,
      },
    ];
  }

  return options;
}
