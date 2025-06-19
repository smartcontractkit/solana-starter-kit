// Export utilities
export * from "./token-utils";
export * from "./provider";
export * from "./get-state-address";
export * from "./client-factory";
export * from "./config-parser";

// Export CCIP utilities but avoid name conflicts
// Import needed types and functions from CCIP modules
import { executeCCIPScript } from "./ccip/executor";
import { CCIPMessageConfig, ExecutorOptions } from "./ccip/config-types";

// Re-export all ccip items under namespace
import * as CCIPUtils from "./ccip";
export { CCIPUtils as CCIP };

// Explicitly export needed items to fix TypeScript errors
export { 
  executeCCIPScript,
  CCIPMessageConfig,
  ExecutorOptions
};
