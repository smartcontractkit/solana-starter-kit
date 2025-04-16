import { deriveStatePda } from "../../ccip-sdk";
import { getCCIPConfig } from "../config";

// Export the functionality as a function instead of auto-executing
export function getStateAddress(network: "devnet" | "mainnet" = "devnet") {
  // Get config to retrieve the program ID
  const config = getCCIPConfig(network);
  const programId = config.programId;

  // Get the state account address using the helper function
  const stateAddress = deriveStatePda(programId);

  return {
    programId,
    stateAddress,
  };
}

// Only run if this script is executed directly
if (require.main === module) {
  const { programId, stateAddress } = getStateAddress();
  console.log(`Program ID: ${programId.toBase58()}`);
  console.log(`State Account Address: ${stateAddress.toBase58()}`);
}
