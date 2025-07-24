/**
 * Unified Configuration Module
 *
 * This module provides a centralized configuration system for both EVM and SVM chains
 * in the CCIP (Cross-Chain Interoperability Protocol) ecosystem.
 */

import { ethers } from "ethers";
import {
  PublicKey,
  Connection,
  ConnectionConfig,
  SystemProgram,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

/**
 * Supported Chain IDs for CCIP operations
 */
export enum ChainId {
  ETHEREUM_SEPOLIA = "ethereum-sepolia",
  BASE_SEPOLIA = "base-sepolia",
  OPTIMISM_SEPOLIA = "optimism-sepolia",
  BSC_TESTNET = "bsc-testnet",
  ARBITRUM_SEPOLIA = "arbitrum-sepolia",
  SOLANA_DEVNET = "solana-devnet",
  SOLANA_MAINNET = "solana-mainnet",
  SONIC_BLAZE = "sonic-blaze",
}

/**
 * Type-safe network identifiers with autocompletion support
 * Use these for network parameters to get IntelliSense suggestions
 */
export type NetworkId = ChainId;

/**
 * Solana-specific network identifiers for better type safety
 */
export type SolanaNetworkId = ChainId.SOLANA_DEVNET | ChainId.SOLANA_MAINNET;

/**
 * EVM-specific network identifiers for better type safety  
 */
export type EVMNetworkId = Exclude<ChainId, SolanaNetworkId>;

/**
 * Commonly used network constants for easy import and better DX
 * These provide autocompletion while avoiding the need to import ChainId enum
 */
export const Networks = {
  // Solana networks
  SOLANA_DEVNET: ChainId.SOLANA_DEVNET,
  SOLANA_MAINNET: ChainId.SOLANA_MAINNET,
  
  // EVM networks
  ETHEREUM_SEPOLIA: ChainId.ETHEREUM_SEPOLIA,
  BASE_SEPOLIA: ChainId.BASE_SEPOLIA,
  OPTIMISM_SEPOLIA: ChainId.OPTIMISM_SEPOLIA,
  BSC_TESTNET: ChainId.BSC_TESTNET,
  ARBITRUM_SEPOLIA: ChainId.ARBITRUM_SEPOLIA,
  SONIC_BLAZE: ChainId.SONIC_BLAZE,
} as const;

/**
 * Type-safe network validation helper
 * Use this to validate network IDs at runtime with full type safety
 */
export function isValidNetworkId(networkId: string): networkId is NetworkId {
  return Object.values(ChainId).includes(networkId as ChainId);
}

/**
 * Type guard for Solana networks
 */
export function isSolanaNetwork(networkId: NetworkId): networkId is SolanaNetworkId {
  return networkId === ChainId.SOLANA_DEVNET || networkId === ChainId.SOLANA_MAINNET;
}

/**
 * Type guard for EVM networks
 */
export function isEVMNetwork(networkId: NetworkId): networkId is EVMNetworkId {
  return !isSolanaNetwork(networkId);
}

/**
 * Chain selectors used to identify chains in CCIP
 */
export const CHAIN_SELECTORS: Record<ChainId, bigint> = {
  [ChainId.ETHEREUM_SEPOLIA]: BigInt("16015286601757825753"),
  [ChainId.BASE_SEPOLIA]: BigInt("10344971235874465080"),
  [ChainId.OPTIMISM_SEPOLIA]: BigInt("5224473277236331295"),
  [ChainId.BSC_TESTNET]: BigInt("13264668187771770619"),
  [ChainId.ARBITRUM_SEPOLIA]: BigInt("3478487238524512106"),
  [ChainId.SOLANA_DEVNET]: BigInt("16423721717087811551"),
  [ChainId.SOLANA_MAINNET]: BigInt("124615329519749607"),
  [ChainId.SONIC_BLAZE]: BigInt("3676871237479449268"),
};

/**
 * Fee token types supported by CCIP
 */
export enum FeeTokenType {
  NATIVE = "native",
  WRAPPED_NATIVE = "wrapped-native",
  LINK = "link",
}

/**
 * EVM Chain Configuration
 */
export interface EVMChainConfig {
  id: ChainId;
  name: string;
  rpcUrl: string;
  chainId: number; // Numeric chain ID (e.g., 11155111 for Sepolia)
  chainSelector: bigint;
  routerAddress: string;
  tokenAdminRegistryAddress: string;
  bnmTokenAddress: string;
  faucetAddress?: string;
  linkTokenAddress: string;
  wrappedNativeAddress: string;
  explorerBaseUrl: string;
  confirmations?: number; // Number of block confirmations to wait for
}

/**
 * Solana Chain Configuration
 */
export interface SVMChainConfig {
  id: ChainId;
  name: string;
  connectionConfig: ConnectionConfig;
  connection: Connection;
  routerProgramId: PublicKey;
  feeQuoterProgramId: PublicKey;
  rmnRemoteProgramId: PublicKey;
  bnmTokenMint: PublicKey;
  linkTokenMint: PublicKey;
  wrappedNativeMint: PublicKey;
  explorerUrl: string;

  // Fields required for CCIPCoreConfig compatibility
  nativeSol: PublicKey;
  systemProgramId: PublicKey;
  receiverProgramId: PublicKey;
}

const DEFAULT_SOLANA_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_SOLANA_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

/**
 * EVM Chain Configurations
 */
const EVM_CONFIGS: Record<
  | ChainId.ETHEREUM_SEPOLIA
  | ChainId.BASE_SEPOLIA
  | ChainId.OPTIMISM_SEPOLIA
  | ChainId.BSC_TESTNET
  | ChainId.ARBITRUM_SEPOLIA
  | ChainId.SONIC_BLAZE,
  EVMChainConfig
> = {
  [ChainId.ETHEREUM_SEPOLIA]: {
    id: ChainId.ETHEREUM_SEPOLIA,
    name: "Ethereum Sepolia",
    rpcUrl: "",
    chainId: 11155111,
    chainSelector: CHAIN_SELECTORS[ChainId.ETHEREUM_SEPOLIA],
    routerAddress: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
    tokenAdminRegistryAddress: "0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82",
    bnmTokenAddress: "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05", // BnM on Sepolia
    faucetAddress: "0x12B0a29ac7dF641e480D195aD79BC1ae2c0B9BcA",
    linkTokenAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    wrappedNativeAddress: "0x097D90c9d3E0B50Ca60e1ae45F6A81010f9FB534",
    explorerBaseUrl: "https://sepolia.etherscan.io/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
  [ChainId.BASE_SEPOLIA]: {
    id: ChainId.BASE_SEPOLIA,
    name: "Base Sepolia",
    rpcUrl: "",
    chainId: 84532,
    chainSelector: CHAIN_SELECTORS[ChainId.BASE_SEPOLIA],
    routerAddress: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93",
    tokenAdminRegistryAddress: "0x736D0bBb318c1B27Ff686cd19804094E66250e17",
    bnmTokenAddress: "0x88A2d74F47a237a62e7A51cdDa67270CE381555e",
    faucetAddress: "",
    linkTokenAddress: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    explorerBaseUrl: "https://sepolia.basescan.org/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
  [ChainId.OPTIMISM_SEPOLIA]: {
    id: ChainId.OPTIMISM_SEPOLIA,
    name: "Optimism Sepolia",
    rpcUrl: "",
    chainId: 11155420,
    chainSelector: CHAIN_SELECTORS[ChainId.OPTIMISM_SEPOLIA],
    routerAddress: "0x114A20A10b43D4115e5aeef7345a1A71d2a60C57",
    tokenAdminRegistryAddress: "0x1d702b1FA12F347f0921C722f9D9166F00DEB67A",
    bnmTokenAddress: "0x8aF4204e30565DF93352fE8E1De78925F6664dA7",
    faucetAddress: "",
    linkTokenAddress: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    explorerBaseUrl: "sepolia-optimism.etherscan.io/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
  [ChainId.BSC_TESTNET]: {
    id: ChainId.BSC_TESTNET,
    name: "BSC Testnet",
    rpcUrl: "",
    chainId: 97,
    chainSelector: CHAIN_SELECTORS[ChainId.BSC_TESTNET],
    routerAddress: "0xE1053aE1857476f36A3C62580FF9b016E8EE8F6f",
    tokenAdminRegistryAddress: "0xF8f2A4466039Ac8adf9944fD67DBb3bb13888f2B",
    bnmTokenAddress: "0xbFA2ACd33ED6EEc0ed3Cc06bF1ac38d22b36B9e9",
    faucetAddress: "",
    linkTokenAddress: "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06",
    wrappedNativeAddress: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    explorerBaseUrl: "https://testnet.bscscan.com/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
  [ChainId.ARBITRUM_SEPOLIA]: {
    id: ChainId.ARBITRUM_SEPOLIA,
    name: "Arbitrum Sepolia",
    rpcUrl: "",
    chainId: 421614,
    chainSelector: CHAIN_SELECTORS[ChainId.ARBITRUM_SEPOLIA],
    routerAddress: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165",
    tokenAdminRegistryAddress: "0x8126bE56454B628a88C17849B9ED99dd5a11Bd2f",
    bnmTokenAddress: "0xA8C0c11bf64AF62CDCA6f93D3769B88BdD7cb93D",
    faucetAddress: "",
    linkTokenAddress: "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
    wrappedNativeAddress: "0xE591bf0A0CF924A0674d7792db046B23CEbF5f34",
    explorerBaseUrl: "https://sepolia.arbiscan.io/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
  [ChainId.SONIC_BLAZE]: {
    id: ChainId.SONIC_BLAZE,
    name: "Sonic Blaze",
    rpcUrl: "",
    chainId: 57054,
    chainSelector: CHAIN_SELECTORS[ChainId.SONIC_BLAZE],
    routerAddress: "0x2fBd4659774D468Db5ca5bacE37869905d8EfA34",
    tokenAdminRegistryAddress: "0xB87d268E7E5d921c72d1D999fa6a2Bfc6A5dBC5C",
    bnmTokenAddress: "0x230c46b9a7c8929A80863bDe89082B372a4c7A99",
    faucetAddress: "",
    linkTokenAddress: "0xd8C1eEE32341240A62eC8BC9988320bcC13c8580",
    wrappedNativeAddress: "0x917FE4b784d1895187Df169aeCc687C03ba12662",
    explorerBaseUrl: "https://testnet.sonicscan.org/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
};

/**
 * Solana Chain Configurations
 */
const SVM_CONFIGS: Record<ChainId.SOLANA_DEVNET | ChainId.SOLANA_MAINNET, SVMChainConfig> = {
  [ChainId.SOLANA_DEVNET]: {
    id: ChainId.SOLANA_DEVNET,
    name: "Solana Devnet",
    connectionConfig: {
      commitment: "confirmed",
      disableRetryOnRateLimit: false,
    },
    connection: new Connection(
      process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_DEVNET_RPC_URL,
      { commitment: "confirmed" }
    ),
    routerProgramId: new PublicKey(
      "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C"
    ),
    feeQuoterProgramId: new PublicKey(
      "FeeQPGkKDeRV1MgoYfMH6L8o3KeuYjwUZrgn4LRKfjHi"
    ),
    rmnRemoteProgramId: new PublicKey(
      "RmnXLft1mSEwDgMKu2okYuHkiazxntFFcZFrrcXxYg7"
    ),
    bnmTokenMint: new PublicKey("3PjyGzj1jGVgHSKS4VR1Hr1memm63PmN8L9rtPDKwzZ6"), // BnM on Solana Devnet
    linkTokenMint: new PublicKey("LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L"),
    wrappedNativeMint: NATIVE_MINT,
    explorerUrl: "https://explorer.solana.com/tx/",

    // Fields required for CCIPCoreConfig compatibility
    nativeSol: PublicKey.default,
    systemProgramId: SystemProgram.programId,
    receiverProgramId: new PublicKey(
      "BqmcnLFSbKwyMEgi7VhVeJCis1wW26VySztF34CJrKFq"
    ), // CCIP Basic Receiver (see programs/ccip-basic-receiver/src/lib.rs)
  },
  [ChainId.SOLANA_MAINNET]: {
    id: ChainId.SOLANA_MAINNET,
    name: "Solana Mainnet",
    connectionConfig: {
      commitment: "confirmed",
      disableRetryOnRateLimit: false,
    },
    connection: new Connection(
      process.env.SOLANA_MAINNET_RPC_URL || DEFAULT_SOLANA_MAINNET_RPC_URL,
      { commitment: "confirmed" }
    ),
    // TODO: Replace with actual mainnet program IDs when CCIP is deployed on mainnet
    routerProgramId: new PublicKey(
      "11111111111111111111111111111111" // PLACEHOLDER: Replace with mainnet CCIP Router program ID
    ),
    feeQuoterProgramId: new PublicKey(
      "11111111111111111111111111111111" // PLACEHOLDER: Replace with mainnet Fee Quoter program ID
    ),
    rmnRemoteProgramId: new PublicKey(
      "11111111111111111111111111111111" // PLACEHOLDER: Replace with mainnet RMN Remote program ID
    ),
    bnmTokenMint: new PublicKey("11111111111111111111111111111111"), // PLACEHOLDER: Replace with mainnet BnM token mint
    linkTokenMint: new PublicKey("11111111111111111111111111111111"), // PLACEHOLDER: Replace with mainnet LINK token mint
    wrappedNativeMint: NATIVE_MINT,
    explorerUrl: "https://explorer.solana.com/tx/",

    // Fields required for CCIPCoreConfig compatibility
    nativeSol: PublicKey.default,
    systemProgramId: SystemProgram.programId,
    receiverProgramId: new PublicKey(
      "11111111111111111111111111111111" // PLACEHOLDER: Replace with mainnet CCIP Basic Receiver program ID
    ),
  },
};

/**
 * Common CCIP message options used across scripts
 */
export interface CCIPMessageOptions {
  // Destination details
  receiver: string;

  // Token transfer details (for token transfers)
  tokenAmounts?: Array<{
    token: string;
    amount: string;
  }>;

  tokenReceiver?: string; // Specific wallet to receive tokens

  // Fee settings
  feeToken?: string;

  // Message data (for arbitrary messaging)
  data?: string;

  // Solana-specific extra args
  computeUnits?: number;
  allowOutOfOrderExecution?: boolean;
  accounts?: string[];
  accountIsWritableBitmap?: string | bigint;

  // Execution controls
  dryRun?: boolean;
}

/**
 * Get EVM chain configuration by chain ID
 */
export function getEVMConfig(chainId: ChainId): EVMChainConfig {
  // Ensure that the chainId is valid and a base configuration exists.
  // This check should ideally be at the very beginning of the function.
  // We assume EVM_CONFIGS is defined and accessible in the function scope.
  if (!EVM_CONFIGS[chainId]) {
    throw new Error(
      `Unsupported or unconfigured EVM chain ID in EVM_CONFIGS: ${chainId}`
    );
  }

  const config: EVMChainConfig = EVM_CONFIGS[chainId];

  // Variable to store the name of the environment variable for the RPC URL.
  let envVarName: string;

  // User's original log line, kept for consistency.
  console.log("chainId", chainId);

  // Determine the environment variable name and load the RPC URL based on the chainId.
  switch (chainId) {
    case ChainId.ETHEREUM_SEPOLIA:
      envVarName = "EVM_RPC_URL";
      config.rpcUrl = process.env[envVarName];
      break;
    case ChainId.BASE_SEPOLIA:
      envVarName = "BASE_SEPOLIA_RPC_URL";
      config.rpcUrl = process.env[envVarName];
      break;
    case ChainId.OPTIMISM_SEPOLIA:
      envVarName = "OPTIMISM_SEPOLIA_RPC_URL";
      config.rpcUrl = process.env[envVarName];
      break;
    case ChainId.BSC_TESTNET:
      envVarName = "BSC_TESTNET_RPC_URL";
      config.rpcUrl = process.env[envVarName];
      break;
    case ChainId.ARBITRUM_SEPOLIA:
      envVarName = "ARBITRUM_SEPOLIA_RPC_URL";
      config.rpcUrl = process.env[envVarName];
      break;
    // Add other explicitly supported EVMChainIds here if they have specific env var names.
    // For example:
    // case ChainId.AVALANCHE_FUJI:
    //   envVarName = "AVALANCHE_FUJI_RPC_URL"; // Or specific name for this chain
    //   config.rpcUrl = process.env[envVarName];
    //   break;
    default:
      // For other EVMChainIds not explicitly listed above but present in EVM_CONFIGS.
      // We'll try a generic environment variable pattern.
      // If an rpcUrl is already set in EVM_CONFIGS for this chain, it might be used if the env var is not found.
      const chainIdString = String(chainId).toUpperCase().replace(/-/g, "_");
      envVarName = `${chainIdString}_RPC_URL`;
      const envRpc = process.env[envVarName];
      if (typeof envRpc === "string") {
        // Check if the environment variable is set (it could be an empty string)
        config.rpcUrl = envRpc; // Prefer the environment variable if set.
      }
      // If envRpc is undefined, config.rpcUrl (which might have been pre-set from EVM_CONFIGS) remains.
      // The validation below will catch cases where rpcUrl is ultimately missing or empty.
      break;
  }

  // Validate that the RPC URL is now set and is not an empty string.
  if (!config.rpcUrl) {
    // This condition also catches an empty string.
    throw new Error(
      `RPC URL for chain ${chainId} is not set or is empty. Please set the environment variable '${envVarName}' or ensure it's correctly configured in EVM_CONFIGS.`
    );
  }

  return config;
}

/**
 * Get Solana chain configuration by network ID
 * 
 * @param networkId - Network identifier (ChainId enum or string)
 * @returns Solana chain configuration
 */
export function getCCIPSVMConfig(networkId: SolanaNetworkId | string): SVMChainConfig {
  // If string provided, resolve to ChainId enum
  let resolvedChainId: ChainId;
  if (typeof networkId === 'string') {
    resolvedChainId = resolveNetworkToChainId(networkId);
  } else {
    resolvedChainId = networkId;
  }

  if (resolvedChainId !== ChainId.SOLANA_DEVNET && resolvedChainId !== ChainId.SOLANA_MAINNET) {
    throw new Error(`Unsupported SVM chain ID: ${resolvedChainId}. Supported: ${ChainId.SOLANA_DEVNET}, ${ChainId.SOLANA_MAINNET}`);
  }

  return SVM_CONFIGS[resolvedChainId];
}

/**
 * Network resolution utilities for enhanced configuration management
 */

/**
 * Resolve network string to ChainId enum
 */
export function resolveNetworkToChainId(network?: string): ChainId {
  if (!network) {
    return ChainId.SOLANA_DEVNET; // Default to devnet
  }

  const normalizedNetwork = network.toLowerCase().trim();
  
  switch (normalizedNetwork) {
    case "devnet":
    case "dev":
    case "solana-devnet":
      return ChainId.SOLANA_DEVNET;
    case "mainnet":
    case "mainnet-beta":
    case "main":
    case "solana-mainnet":
      return ChainId.SOLANA_MAINNET;
    default:
      throw new Error(
        `Invalid network: ${network}. Supported networks: devnet, mainnet, solana-devnet, solana-mainnet`
      );
  }
}

/**
 * Validate network safety for production operations
 */
export function validateNetworkSafety(network: ChainId, operation: string): void {
  if (network === ChainId.SOLANA_MAINNET) {
    // Check for explicit mainnet allowance
    if (!process.env.ALLOW_MAINNET) {
      throw new Error(
        `🚨 MAINNET PROTECTION: ${operation} on mainnet is disabled for safety.\n` +
        `To enable mainnet operations, set environment variable: ALLOW_MAINNET=true\n` +
        `⚠️  WARNING: Mainnet operations use real SOL and can incur costs!`
      );
    }
    
    // Additional safety check for placeholder program IDs
    const config = SVM_CONFIGS[network];
    if (config.routerProgramId.toString() === "11111111111111111111111111111111") {
      throw new Error(
        `🚨 MAINNET NOT READY: CCIP programs are not yet deployed on mainnet.\n` +
        `Mainnet configuration contains placeholder program IDs.`
      );
    }
  }
}

/**
 * Enhanced network configuration resolver with safety checks
 * This is the main function scripts should use for network-agnostic configuration
 */
export function resolveNetworkConfig(options: { network?: string }): SVMChainConfig {
  // Step 1: Resolve network from options, environment, or default
  const networkString = options.network || process.env.SOLANA_NETWORK || "devnet";
  
  // Step 2: Convert to ChainId enum
  const chainId = resolveNetworkToChainId(networkString);
  
  // Step 3: Validate safety for the operation
  validateNetworkSafety(chainId, "configuration resolution");
  
  // Step 4: Get configuration
  const config = getCCIPSVMConfig(chainId);
  
  // Step 5: Validate RPC connectivity (basic check)
  validateNetworkConnectivity(config);
  
  return config;
}

/**
 * Validate network connectivity and configuration
 */
function validateNetworkConnectivity(config: SVMChainConfig): void {
  if (!config.connection.rpcEndpoint) {
    throw new Error(
      `Invalid RPC endpoint for network ${config.id}. Check your configuration.`
    );
  }
  
  // Add more validation if needed (ping RPC, check program deployments, etc.)
  // For now, just validate the endpoint is a valid URL
  try {
    new URL(config.connection.rpcEndpoint);
  } catch (error) {
    throw new Error(
      `Invalid RPC URL format for network ${config.id}: ${config.connection.rpcEndpoint}`
    );
  }
}

/**
 * Get EVM fee token address based on config and token type
 */
export function getEVMFeeTokenAddress(
  config: EVMChainConfig,
  feeTokenType?: string
): string {
  if (!feeTokenType) {
    return config.linkTokenAddress; // Default to LINK
  }

  switch (feeTokenType.toLowerCase()) {
    case FeeTokenType.NATIVE:
      return ethers.ZeroAddress;
    case FeeTokenType.WRAPPED_NATIVE:
      return config.wrappedNativeAddress;
    case FeeTokenType.LINK:
      return config.linkTokenAddress;
    default:
      // If it's a valid address, use it directly
      if (ethers.isAddress(feeTokenType)) {
        return feeTokenType;
      }
      return config.linkTokenAddress; // Default to LINK if not recognized
  }
}

/**
 * Get SVM fee token based on config and token type
 */
export function getSVMFeeToken(
  config: SVMChainConfig,
  feeTokenType?: string
): PublicKey {
  if (!feeTokenType) {
    return PublicKey.default; // Default to native SOL
  }

  switch (feeTokenType.toLowerCase()) {
    case FeeTokenType.NATIVE:
      return PublicKey.default;
    case FeeTokenType.WRAPPED_NATIVE:
      return config.wrappedNativeMint;
    case FeeTokenType.LINK:
      return config.linkTokenMint;
    default:
      // Try to parse as a public key
      try {
        return new PublicKey(feeTokenType);
      } catch {
        return PublicKey.default; // Default to native SOL if not recognized
      }
  }
}

/**
 * Get explorer URL for a specific chain and transaction hash
 */
export function getExplorerUrl(chainId: ChainId, txHash: string): string {
  if (
    chainId === ChainId.ETHEREUM_SEPOLIA ||
    chainId === ChainId.BASE_SEPOLIA ||
    chainId === ChainId.OPTIMISM_SEPOLIA ||
    chainId === ChainId.BSC_TESTNET ||
    chainId === ChainId.ARBITRUM_SEPOLIA ||
    chainId === ChainId.SONIC_BLAZE
  ) {
    const baseUrl = EVM_CONFIGS[chainId].explorerBaseUrl;
    // Ensure base URL ends with a slash for proper URL joining
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return `${normalizedBaseUrl}tx/${txHash}`;
  } else if (chainId === ChainId.SOLANA_DEVNET) {
    const baseUrl = SVM_CONFIGS[ChainId.SOLANA_DEVNET].explorerUrl;
    // Ensure base URL ends with a slash for proper URL joining
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return `${normalizedBaseUrl}${txHash}?cluster=devnet`;
  }
  throw new Error(`No explorer URL available for chain ID: ${chainId}`);
}

/**
 * Get explorer URL for a specific chain and address (mint, token account, wallet, etc.)
 */
export function getExplorerAddressUrl(chainId: ChainId, address: string): string {
  if (
    chainId === ChainId.ETHEREUM_SEPOLIA ||
    chainId === ChainId.BASE_SEPOLIA ||
    chainId === ChainId.OPTIMISM_SEPOLIA ||
    chainId === ChainId.BSC_TESTNET ||
    chainId === ChainId.ARBITRUM_SEPOLIA ||
    chainId === ChainId.SONIC_BLAZE
  ) {
    const baseUrl = EVM_CONFIGS[chainId].explorerBaseUrl;
    // Ensure base URL ends with a slash for proper URL joining
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return `${normalizedBaseUrl}address/${address}`;
  } else if (chainId === ChainId.SOLANA_DEVNET) {
    // For Solana, use /address/ path instead of /tx/
    return `https://explorer.solana.com/address/${address}?cluster=devnet`;
  }
  throw new Error(`No explorer address URL available for chain ID: ${chainId}`);
}
