// Simple script to test that our configuration can be loaded correctly
import { 
  ChainId, 
  CHAIN_SELECTORS, 
  getEVMConfig, 
  getSVMConfig 
} from './config/index.js';

console.log("Configuration loaded successfully!");
console.log("Available chain IDs:", Object.keys(ChainId));
console.log("Chain selectors:", CHAIN_SELECTORS);

// Test Ethereum configuration
const evmConfig = getEVMConfig(ChainId.ETHEREUM_SEPOLIA);
console.log("\nEthereum Sepolia Configuration:");
console.log("Name:", evmConfig.name);
console.log("Router Address:", evmConfig.routerAddress);
console.log("Explorer URL:", evmConfig.blockExplorerUrl);

// Test Solana configuration
const svmConfig = getSVMConfig(ChainId.SOLANA_DEVNET);
console.log("\nSolana Devnet Configuration:");
console.log("Name:", svmConfig.name);
console.log("Router Program ID:", svmConfig.routerProgramId);
console.log("Explorer URL:", svmConfig.blockExplorerUrl);

console.log("\nAll tests passed!"); 