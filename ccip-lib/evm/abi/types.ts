/**
 * Core message types for CCIP cross-chain messaging protocol
 * These types represent the conceptual message structures used in the SDK,
 * distinct from the low-level contract interfaces.
 */

// Token amount structure for EVM chains
export interface EVMTokenAmount {
  token: string;
  amount: bigint;
}

// EVM to Any message structure (for sending messages from EVM to any chain)
export interface EVM2AnyMessage {
  receiver: string;
  data: string;
  tokenAmounts: EVMTokenAmount[];
  feeToken: string;
  extraArgs: string;
}

// Chain structure definitions
export interface OffRampConfig {
  sourceChainSelector: bigint;
  offRamp: string;
  lastUpdated?: bigint;
  active?: boolean;
}

// Message execution status
export enum MessageStatus {
  UNTRIGGERED = 0,
  IN_PROGRESS = 1,
  SUCCESS = 2,
  FAILURE = 3,
}

// Generic extra args V2 tag
export const GENERIC_EXTRA_ARGS_V2_TAG = "0x181dcf10";

// Generic extra args for CCIP
export interface GenericExtraArgsV2 {
  gasLimit: bigint;
  allowOutOfOrderExecution: boolean;
}
