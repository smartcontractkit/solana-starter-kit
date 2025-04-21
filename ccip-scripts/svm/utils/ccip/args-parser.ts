import { parseCCIPSendArgs } from "../index";
import { CCIPOptions, TokenTransfer } from "./config-types";

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