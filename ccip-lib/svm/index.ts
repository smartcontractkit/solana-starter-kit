// Core components
export * from "./core/client/accounts";
export * from "./core/client/index";

// Export models with specific names to avoid conflicts
export type {
  CCIPClientOptions,
  CCIPSendRequest,
  CCIPSendOptions,
  CCIPFeeRequest,
  CCIPSendResult,
  ExtraArgsOptions,
  ExtraArgsV1,
  CCIPProvider,
  CCIPCoreConfig,
  CCIPContext,
  CCIPClientKeypairOptions,
} from "./core/models";

// Utilities
export * from "./utils/pdas";
export * from "./utils/logger";
export * from "./utils/errors";
export * from "./utils/conversion";
export * from "./utils/keypair";
export * from "./utils/token";

// Bindings exports
export * from "./bindings/types";
export * from "./bindings/accounts";

// Token Pool exports
export * from "./tokenpools/abstract";
export * from "./tokenpools/factory";
export { BurnMintTokenPoolClient } from "./tokenpools/burnmint";
export type {
  InitChainRemoteConfigOptions,
  EditChainRemoteConfigOptions,
  RemoteChainConfigResult,
} from "./tokenpools";

// Token Creation exports
export * from "./utils/token-creation";
export * from "./core/token-manager";
export type {
  TokenMetadata,
  Token2022Config,
  TokenCreationResult,
  MintResult,
  TokenOperationOptions,
} from "./utils/token-creation";
export type {
  TokenManagerOptions,
  ExtendedToken2022Config,
  TokenManagerChainConfig,
} from "./core/token-manager";

// Export version
export const SDK_VERSION = "0.1.0";
