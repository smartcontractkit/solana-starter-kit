/**
 * Prod-testnet CCIP configuration: Solana Devnet <-> Ethereum Sepolia.
 *
 * Addresses are the public CCIP deployments; chain selectors come from the SDK's
 * network registry so they can never drift from the on-chain lanes.
 */
import { networkInfo } from '@chainlink/ccip-sdk'

export const SOLANA_DEVNET = {
  name: 'Solana Devnet',
  rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
  router: 'Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C',
  bnmTokenMint: '3PjyGzj1jGVgHSKS4VR1Hr1memm63PmN8L9rtPDKwzZ6',
  linkTokenMint: 'LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L',
  wrappedNativeMint: 'So11111111111111111111111111111111111111112',
  receiverProgramId: 'BqmcnLFSbKwyMEgi7VhVeJCis1wW26VySztF34CJrKFq', // ccip-basic-receiver (v1)
  receiverV2ProgramId: 'BpR2B1WNYgssZwDQEDm23EoFQqJVuCrGg59uFB4afjq2', // ccip-receiver-v2
  senderV2ProgramId: '7zGbs3PZSrZryQqJFpcYZf8kJ8BbxavmBngcLmYy9ds5', // ccip-sender-v2
  /** Solana Explorer defaults to mainnet — devnet links need the cluster query param. */
  txUrl: (hash: string): string => `https://explorer.solana.com/tx/${hash}?cluster=devnet`,
} as const

export const ETHEREUM_SEPOLIA = {
  name: 'Ethereum Sepolia',
  rpcUrl: process.env.EVM_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com',
  router: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
  bnmTokenAddress: '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05',
  linkTokenAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
  wrappedNativeAddress: '0x097D90c9d3E0B50Ca60e1ae45F6A81010f9FB534',
  receiverAddress: process.env.EVM_RECEIVER_ADDRESS, // deployed BasicCCIPReceiver
  explorerUrl: 'https://sepolia.etherscan.io/tx/',
  txUrl: (hash: string): string => `https://sepolia.etherscan.io/tx/${hash}`,
} as const

/** Shared defaults for the send/fee scripts. */
export const DEFAULTS = {
  /**
   * Gas limit for the receiver's ccipReceive callback (EVM destination).
   * BasicCCIPReceiver stores the full Any2EVMMessage struct (~360k gas), so the
   * SDK's 200k default is not enough — 400k covers it with margin.
   */
  evmGasLimit: 400_000,
  /** Compute units for the receiver's ccip_receive call (SVM destination). */
  svmComputeUnits: 100_000,
  /** Transaction commitment used for all Solana reads/writes. */
  solanaCommitment: 'confirmed',
} as const

/** CCIP message explorer. */
export const CCIP_EXPLORER_URL = 'https://ccip.chain.link/msg/'

/**
 * SVM-form no-execution sentinel: the 4-byte NO_EXECUTION_TAG left-aligned in a
 * 32-byte pubkey (mirrors EVM's bytes4->bytes20 cast). The SDK's EVM
 * NO_EXECUTION_ADDRESS is 20 bytes and breaks the Solana router's Borsh parsing,
 * so Solana-source sends must use this pubkey as the executor instead.
 */
export const SVM_NO_EXECUTION_PUBKEY = 'GrrpT6dDfEEdVZLj8xXQMhBktzSYpaCsSmEgK6nuMsAo'

/**
 * Resolve a --fee-token CLI value to a Solana fee-token mint: null = native SOL
 * (the router normalizes it to the wrapped SOL mint for billing), or the mint
 * address for link / wsol.
 */
export function solanaFeeTokenMint(choice: string | undefined): string | null {
  switch (choice) {
    case undefined:
    case 'native':
      return null
    case 'link':
      return SOLANA_DEVNET.linkTokenMint
    case 'wsol':
      return SOLANA_DEVNET.wrappedNativeMint
    default:
      throw new Error(`Invalid fee token "${choice}": use native, link, or wsol`)
  }
}

/**
 * Resolve a --fee-token CLI value to an EVM fee-token address: undefined = native
 * ETH, or the ERC-20 address for link / weth.
 */
export function evmFeeTokenAddress(choice: string | undefined): string | undefined {
  switch (choice) {
    case undefined:
    case 'native':
      return undefined
    case 'link':
      return ETHEREUM_SEPOLIA.linkTokenAddress
    case 'weth':
      return ETHEREUM_SEPOLIA.wrappedNativeAddress
    default:
      throw new Error(`Invalid fee token "${choice}": use native, link, or weth`)
  }
}

/** Chain selectors, resolved from the SDK's network registry. */
export const SOLANA_DEVNET_SELECTOR = networkInfo('solana-devnet').chainSelector
export const ETHEREUM_SEPOLIA_SELECTOR = networkInfo('ethereum-testnet-sepolia').chainSelector

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`)
  }
  return value
}
