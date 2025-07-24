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
  tokenAmounts?: Array<{ tokenMint: string; amount: string | number }>;

  /** EVM receiver address for cross-chain messages */
  evmReceiverAddress?: string;
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




