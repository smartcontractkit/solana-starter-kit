// Core components
export { CCIPMessenger } from "./core/client/index";
export type {
  CCIPEVMContext,
  CCIPEVMConfig,
  CCIPEVMReadProvider,
  CCIPEVMWriteProvider,
  FeeRequest,
  FeeResult,
  TokenAmount,
  SolanaExtraArgsOptions,
  CCIPMessageRequest,
  CCIPMessageResult,
} from "./core/models";

// Export MessageStatus enum
export { MessageStatus } from "./core/models";

// Export factory functions removed - use direct class instantiation instead

// Export specialized contract clients
export {
  RouterClient,
  TokenAdminRegistryClient,
  TokenPoolClient,
  ERC20Client,
  BurnMintERC677HelperClient,
  // BurnMintERC677Helper interfaces
  MultiDripOptions,
  MultiDripResult,
} from "./core/contracts/index";

// Export contract factories
export {
  Router__factory,
  TokenAdminRegistry__factory,
  BurnMintTokenPool__factory,
  ERC20__factory,
  BurnMintERC677Helper__factory,
} from "./types/contracts/factories/index";

// Note: We don't export raw ABIs or types directly.
// Users should use the client classes (RouterClient, ERC20Client, etc.)
// or factory functions (createRouterClient, createERC20Client, etc.)
// for proper error handling, logging, and business logic.

// Utility functions for Solana
export {
  encodeSolanaAddressToBytes32,
  encodeSolanaExtraArgs,
  hexToSolanaAddress,
  createSolanaExtraArgs,
  SVM_EXTRA_ARGS_V1_TAG,
} from "./utils/solana";

// Utility functions for CCIP
export {
  extractCCIPMessageFromReceipt,
  getMessageStatusString,
  sleep,
  GENERIC_EXTRA_ARGS_V2_TAG,
} from "./utils/ccip";

// Utility functions for transactions
export {
  executeBatch,
  calculateTotalGasUsed,
  formatBatchSummary,
} from "./utils/transactions";

export type {
  BatchOptions,
  BatchResult,
  TransactionOperation,
} from "./utils/transactions";

// Logger utilities
export {
  createLogger,
  logLevelToString,
  parseLogLevel,
  LogLevel,
} from "./utils/logger";

// Export SDK version
export const SDK_VERSION = "0.1.0";
