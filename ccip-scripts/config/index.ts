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
  AVALANCHE_FUJI = "avalanche-fuji",
  SOLANA_DEVNET = "solana-devnet",
}

/**
 * Chain selectors used to identify chains in CCIP
 */
export const CHAIN_SELECTORS: Record<ChainId, bigint> = {
  [ChainId.ETHEREUM_SEPOLIA]: BigInt("16015286601757825753"),
  [ChainId.AVALANCHE_FUJI]: BigInt("14767482510784806043"),
  [ChainId.SOLANA_DEVNET]: BigInt("16423721717087811551"),
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

/**
 * EVM Chain Configurations
 */
const EVM_CONFIGS: Record<
  ChainId.ETHEREUM_SEPOLIA | ChainId.AVALANCHE_FUJI,
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
    bnmTokenAddress: "0x316496C5dA67D052235B9952bc42db498d6c520b", // BnM on Sepolia
    linkTokenAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    wrappedNativeAddress: "0x097D90c9d3E0B50Ca60e1ae45F6A81010f9FB534",
    explorerBaseUrl: "https://sepolia.etherscan.io/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
  [ChainId.AVALANCHE_FUJI]: {
    id: ChainId.AVALANCHE_FUJI,
    name: "Avalanche Fuji",
    rpcUrl: "",
    chainId: 43113,
    chainSelector: CHAIN_SELECTORS[ChainId.AVALANCHE_FUJI],
    routerAddress: "0xF694E193200268f9a4868e4Aa017A0118C9a8177",
    tokenAdminRegistryAddress: "0xA92053a4a3922084d992fD2835bdBa4caC6877e6",
    bnmTokenAddress: "0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4",
    linkTokenAddress: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
    wrappedNativeAddress: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
    explorerBaseUrl: "https://testnet.snowtrace.io/",
    confirmations: 3, // Wait for 3 blocks for better reliability
  },
};

/**
 * Solana Chain Configurations
 */
const SVM_CONFIGS: Record<ChainId.SOLANA_DEVNET, SVMChainConfig> = {
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
    linkTokenMint: new PublicKey(
      "GAn1RmBY76BjdqPAFnqM4jhqSSeeo9Zf7ASqHoWLdwZb"
    ),
    wrappedNativeMint: NATIVE_MINT,
    explorerUrl: "https://explorer.solana.com/tx/",

    // Fields required for CCIPCoreConfig compatibility
    nativeSol: PublicKey.default,
    systemProgramId: SystemProgram.programId,
    receiverProgramId: new PublicKey(
      "BqmcnLFSbKwyMEgi7VhVeJCis1wW26VySztF34CJrKFq"
    ), // CCIP Basic Receiver (see programs/ccip-basic-receiver/src/lib.rs)
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
  // Validate supported chains
  switch (chainId) {
    case ChainId.ETHEREUM_SEPOLIA:
    case ChainId.AVALANCHE_FUJI:
      const config = EVM_CONFIGS[chainId];

      // Get environment variable name based on chain
      console.log("chainId", chainId);
      let envVarName: string;
      switch (chainId) {
        case ChainId.ETHEREUM_SEPOLIA:
          config.rpcUrl = process.env.EVM_RPC_URL;
          break;
        case ChainId.AVALANCHE_FUJI:
          config.rpcUrl = process.env.AVAX_RPC_URL;
          break;
        default:
          envVarName = "UNKNOWN_RPC_URL";
      }

      // Validate that the RPC URL is available
      if (!config.rpcUrl) {
        throw new Error(
          `RPC URL for ${chainId} is not set. Please set ${envVarName} in your environment variables.`
        );
      }

      return config;

    default:
      throw new Error(`Unsupported EVM chain ID: ${chainId}`);
  }
}

/**
 * Get Solana chain configuration by chain ID
 */
export function getCCIPSVMConfig(chainId: ChainId): SVMChainConfig {
  if (chainId !== ChainId.SOLANA_DEVNET) {
    throw new Error(`Unsupported SVM chain ID: ${chainId}`);
  }

  return SVM_CONFIGS[chainId];
}

/**
 * Adapter interface to map between our config and CCIPCoreConfig
 * This ensures compatibility with the library without changing our naming
 */
export interface CCIPCoreAdapter {
  ccipRouterProgramId: PublicKey;
  feeQuoterProgramId: PublicKey;
  rmnRemoteProgramId: PublicKey;
  linkTokenMint: PublicKey;
  tokenMint: PublicKey;
  nativeSol: PublicKey;
  systemProgramId: PublicKey;
  programId: PublicKey;
}

/**
 * Convert SVMChainConfig to CCIPCoreAdapter for library compatibility
 */
export function adaptSVMConfigForLibrary(
  config: SVMChainConfig
): CCIPCoreAdapter {
  return {
    ccipRouterProgramId: config.routerProgramId,
    feeQuoterProgramId: config.feeQuoterProgramId,
    rmnRemoteProgramId: config.rmnRemoteProgramId,
    linkTokenMint: config.linkTokenMint,
    tokenMint: config.bnmTokenMint,
    nativeSol: config.nativeSol,
    systemProgramId: config.systemProgramId,
    programId: config.receiverProgramId,
  };
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
    chainId === ChainId.AVALANCHE_FUJI
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
