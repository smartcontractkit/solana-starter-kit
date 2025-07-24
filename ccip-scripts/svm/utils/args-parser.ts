import { createLogger } from "../../../ccip-lib/svm/utils/logger";
import { ChainId, CHAIN_SELECTORS } from "../../config";

const logger = createLogger("ArgsParser");

/**
 * Argument definition type
 */
export interface ArgDefinition {
  name: string;
  description: string;
  required: boolean;
  type?: "string" | "number" | "boolean" | "remote-chain";
  default?: any;
}

/**
 * Convert chain ID to display name
 * @param chainId Chain ID enum value
 * @returns Human-readable chain name
 */
function chainIdToDisplayName(chainId: ChainId): string {
  return chainId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get available remote chain options (excluding Solana since we're deploying on Solana)
 * @returns Array of available remote chains with their details
 */
export function getAvailableRemoteChains(): Array<{
  id: ChainId;
  name: string;
  selector: bigint;
}> {
  return Object.values(ChainId)
    .filter((chainId) => !chainId.startsWith('solana-'))
    .map((chainId) => ({
      id: chainId,
      name: chainIdToDisplayName(chainId),
      selector: CHAIN_SELECTORS[chainId],
    }));
}

/**
 * Display available remote chains to the user (excludes Solana since we're deploying on Solana)
 */
export function displayAvailableRemoteChains(): void {
  const remoteChains = getAvailableRemoteChains();

  console.log("\nAvailable Remote Chains:");
  console.log("========================");
  remoteChains.forEach((chain, index) => {
    console.log(`${index + 1}. ${chain.name}`);
    console.log(`   Chain ID: ${chain.id}`);
    console.log(`   Selector: ${chain.selector.toString()}`);
    console.log("");
  });
}

/**
 * Parse a remote chain argument (must be a valid chain ID)
 * @param value The chain ID from command line
 * @returns The chain selector as bigint
 */
export function parseRemoteChain(value: string): bigint {
  // Validate chain ID and ensure it's not Solana
  if (
    Object.values(ChainId).includes(value as ChainId) &&
    !value.startsWith('solana-')
  ) {
    const chainId = value as ChainId;
    const selector = CHAIN_SELECTORS[chainId];
    logger.info(
      `Selected remote chain: ${chainIdToDisplayName(
        chainId
      )} (${selector.toString()})`
    );
    return selector;
  }

  // If no match found, display available options and throw error
  displayAvailableRemoteChains();
  throw new Error(
    `Invalid remote chain: "${value}". ` +
      `Please use a valid chain ID (e.g., "ethereum-sepolia").`
  );
}

/**
 * Parse command line arguments based on provided definitions
 * @param definitions Array of argument definitions
 * @returns Object containing parsed arguments
 */
export function parseArgs(definitions: ArgDefinition[]): Record<string, any> {
  const args = process.argv.slice(2);
  const result: Record<string, any> = {};

  // First, initialize with default values
  definitions.forEach((def) => {
    if (def.default !== undefined) {
      result[def.name] = def.default;
    }
  });

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const argName = arg.substring(2);
      const def = definitions.find((d) => d.name === argName);

      if (def && i + 1 < args.length) {
        let value: any = args[i + 1];

        // Skip arguments that start with '--'
        if (value.startsWith("--")) {
          // Boolean arguments can be specified without a value
          if (def.type === "boolean") {
            result[def.name] = true;
            continue; // Don't increment i
          } else {
            throw new Error(`Missing value for argument: ${def.name}`);
          }
        }

        // Parse value according to type
        if (def.type === "number") {
          value = Number(value);
          if (isNaN(value)) {
            throw new Error(`Invalid number for argument: ${def.name}`);
          }
        } else if (def.type === "boolean") {
          value = value === "true";
        } else if (def.type === "remote-chain") {
          value = parseRemoteChain(value);
        }

        result[def.name] = value;
        i++; // Skip the value
      }
    }
  }

  // Check for required arguments
  const missingArgs = definitions
    .filter((def) => def.required && result[def.name] === undefined)
    .map((def) => def.name);

  if (missingArgs.length > 0) {
    logger.error(`Missing required arguments: ${missingArgs.join(", ")}`);
    console.log("\nUsage:");
    definitions.forEach((def) => {
      let typeDescription: string = def.type || "string";
      if (def.type === "remote-chain") {
        typeDescription = "remote-chain (chain-id)";
      }
      console.log(
        `  --${def.name} ${typeDescription} ${
          def.required ? "(required)" : "(optional)"
        }: ${def.description}`
      );
    });

    // If there are remote-chain arguments, show available chains
    const hasRemoteChainArg = definitions.some(
      (def) => def.type === "remote-chain"
    );
    if (hasRemoteChainArg) {
      displayAvailableRemoteChains();
    }

    process.exit(1);
  }

  return result;
}
