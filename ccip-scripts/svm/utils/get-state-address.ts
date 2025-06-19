import { deriveStatePda } from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig } from "../../config";

// Export the functionality as a function instead of auto-executing
export function getStateAddress(network: "devnet" | "mainnet" = "devnet") {
  try {
    const config = getConfigPDA(network);
    const statePDA = deriveStatePda(config.routerProgramId);
    
    return {
      routerProgramId: config.routerProgramId.toString(),
      statePDA: statePDA.toString(),
    };
  } catch (error) {
    console.error("Error getting state address:", error);
    return {
      routerProgramId: "Error",
      statePDA: "Error",
    };
  }
}

export function getConfigPDA(network: "devnet" | "mainnet" = "devnet") {
  const chainId = network === "mainnet" 
    ? ChainId.SOLANA_DEVNET // For now, mainnet is not supported
    : ChainId.SOLANA_DEVNET;
    
  const config = getCCIPSVMConfig(chainId);
  return config;
}

// Only run if this script is executed directly
if (require.main === module) {
  const address = getStateAddress();
  console.log(address);
}
