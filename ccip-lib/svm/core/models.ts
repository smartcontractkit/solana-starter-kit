import { PublicKey, Keypair, Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { LogLevel } from "../utils/logger";

/**
 * CCIP Send Request
 */
export interface CCIPSendRequest {
  readonly destChainSelector: BN;
  readonly receiver: Uint8Array;
  readonly data: Uint8Array;
  readonly tokenAmounts: {
    readonly token: PublicKey;
    readonly amount: BN;
  }[];
  readonly feeToken: PublicKey;
  readonly extraArgs: Uint8Array;
}

/**
 * CCIP Fee Request
 */
export interface CCIPFeeRequest {
  readonly destChainSelector: BN;
  readonly message: {
    readonly receiver: Uint8Array;
    readonly data: Uint8Array;
    readonly tokenAmounts: {
      readonly token: PublicKey;
      readonly amount: BN;
    }[];
    readonly feeToken: PublicKey;
    readonly extraArgs: Uint8Array;
  };
}

/**
 * Result of a fee calculation
 */
export interface GetFeeResult {
  token: PublicKey;
  amount: BN;
  juels: BN;
}

/**
 * Result of a CCIP send with message ID
 */
export interface CCIPSendResult {
  txSignature: string;
  messageId?: string;
  destinationChainSelector?: string;
  sequenceNumber?: string;
}

/**
 * Extra arguments for CCIP send
 */
export interface ExtraArgsV1 {
  gasLimit: number;
  strict: boolean;
}

/**
 * Options for creating extra arguments
 */
export interface ExtraArgsOptions {
  gasLimit?: number;
  allowOutOfOrderExecution?: boolean;
}

/**
 * Options for CCIPClient configuration
 */
export interface CCIPClientOptions {
  /**
   * Log level for the client
   * @default LogLevel.INFO
   */
  logLevel?: LogLevel;
}

/**
 * Options for sending CCIP messages
 */
export interface CCIPSendOptions {
  /**
   * Whether to skip the preflight transaction check
   * @default false
   */
  skipPreflight?: boolean;
}

/**
 * Provider interface to abstract wallet and connection
 */
export interface CCIPProvider {
  /** Solana RPC connection */
  connection: Connection;
  
  /** Wallet or keypair for signing transactions */
  wallet: Keypair;
  
  /** Get the public key address of the signer */
  getAddress(): PublicKey;
  
  /** Sign a transaction */
  signTransaction(tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
}

/**
 * Core configuration needed by all CCIP modules
 */
export interface CCIPCoreConfig {
  /** CCIP Router program ID */
  ccipRouterProgramId: PublicKey;
  
  /** Fee Quoter program ID */
  feeQuoterProgramId: PublicKey;
  
  /** RMN Remote program ID */
  rmnRemoteProgramId: PublicKey;
  
  /** LINK token mint */
  linkTokenMint: PublicKey;
  
  /** Token mint for the application */
  tokenMint: PublicKey;
  
  /** Native SOL public key */
  nativeSol: PublicKey;
  
  /** System program ID */
  systemProgramId: PublicKey;
  
  /** CCIP receiver program ID */
  programId: PublicKey;
}

/**
 * Combined context with provider, config and logger
 */
export interface CCIPContext {
  /** Provider for connecting to the blockchain */
  provider: CCIPProvider;
  
  /** Core configuration */
  config: CCIPCoreConfig;
  
  /** Optional logger */
  logger?: Logger;
}

/**
 * Options for creating a CCIP client from a keypair
 */
export interface CCIPClientKeypairOptions {
  /** Path to keypair file */
  keypairPath: string;
  
  /** Core configuration */
  config: CCIPCoreConfig;
  
  /** Log level */
  logLevel?: LogLevel;
  
  /** RPC endpoint URL */
  endpoint?: string;
  
  /** Commitment level */
  commitment?: string;
}

/**
 * Logger interface imported from logger.ts
 */
export interface Logger {
  trace(...message: any[]): void;
  debug(...message: any[]): void;
  info(...message: any[]): void;
  warn(...message: any[]): void;
  error(...message: any[]): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
} 