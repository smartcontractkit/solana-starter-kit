/**
 * CCIP State Address Utility (CLI Framework Version)
 *
 * This utility script derives and displays router program ID and state PDA addresses.
 * It helps developers understand the state structure and derive important addresses.
 */

import { deriveStatePda } from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig, resolveNetworkToChainId, resolveNetworkConfig } from "../../config";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "./cli-framework";

/**
 * Options specific to the get-state-address command
 */
interface GetStateAddressOptions extends BaseCommandOptions {
  // Uses inherited network from BaseCommandOptions
}

/**
 * Get State Address Command
 */
class GetStateAddressCommand extends CCIPCommand<GetStateAddressOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "get-state-address",
      description: "🏗️ CCIP State Address Utility\n\nDerives and displays router program ID and state PDA addresses for the specified network. Helps developers understand the state structure and derive important addresses.",
      examples: [
        "# Get state address for default network",
        "yarn svm:utils:get-state-address",
        "",
        "# Get state address for specific network",
        "yarn svm:utils:get-state-address --network devnet",
        "",
        "# With debug logging",
        "yarn svm:utils:get-state-address --network devnet --log-level DEBUG"
      ],
      notes: [
        "This is a utility script for address derivation",
        "No wallet required - derives addresses from program configuration",
        "Useful for understanding CCIP state structure",
        "Helps verify program deployment addresses",
        "Returns router program ID and corresponding state PDA",
        "State PDA is derived deterministically from router program ID"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      // No additional arguments - uses inherited network from BaseCommandOptions
    ];
  }

  /**
   * Get state address for the specified network
   */
  private getStateAddress(network: "devnet" | "mainnet" = "devnet") {
    try {
      const config = this.getConfigPDA(network);
      const statePDA = deriveStatePda(config.routerProgramId);
      
      return {
        routerProgramId: config.routerProgramId.toString(),
        statePDA: statePDA.toString(),
      };
    } catch (error) {
      this.logger.error("Error getting state address:", error);
      return {
        routerProgramId: "Error",
        statePDA: "Error",
      };
    }
  }

  /**
   * Get configuration PDA for the specified network
   */
  private getConfigPDA(network: "devnet" | "mainnet" = "devnet") {
    const chainId = resolveNetworkToChainId(network);
    const config = getCCIPSVMConfig(chainId);
    return config;
  }

  protected async execute(): Promise<void> {
    this.logger.info("🏗️ CCIP State Address Utility");
    this.logger.info("=========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    const networkName = config.id === "solana-devnet" ? "devnet" : "mainnet";

    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Chain ID: ${config.id}`);

    this.logger.debug("Configuration details:");
    this.logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`  Commitment level: ${config.connection.commitment}`);

    try {
      // Get state addresses
      this.logger.info("");
      this.logger.info("🔍 DERIVING STATE ADDRESSES");
      this.logger.info("=========================================");
      this.logger.info("Calculating router program ID and state PDA...");

      const addresses = this.getStateAddress(networkName);

      if (addresses.routerProgramId === "Error" || addresses.statePDA === "Error") {
        throw new Error("Failed to derive state addresses");
      }

      // Display results
      this.logger.info("");
      this.logger.info("📋 STATE ADDRESS INFORMATION");
      this.logger.info("=========================================");
      this.logger.info(`Router Program ID: ${addresses.routerProgramId}`);
      this.logger.info(`State PDA: ${addresses.statePDA}`);

      // Verify with configuration
      this.logger.info("");
      this.logger.info("🔧 CONFIGURATION VERIFICATION");
      this.logger.info("=========================================");
      
      if (addresses.routerProgramId === config.routerProgramId.toString()) {
        this.logger.info("✅ Router program ID matches configuration");
      } else {
        this.logger.warn("⚠️ Router program ID differs from configuration");
        this.logger.warn(`  Derived: ${addresses.routerProgramId}`);
        this.logger.warn(`  Config:  ${config.routerProgramId.toString()}`);
      }

      // Additional network information
      this.logger.info("");
      this.logger.info("🌐 NETWORK DETAILS");
      this.logger.info("=========================================");
      this.logger.info(`Network Name: ${networkName}`);
      this.logger.info(`RPC Endpoint: ${config.connection.rpcEndpoint}`);
      this.logger.info(`Router Program: ${config.routerProgramId.toString()}`);
      this.logger.info(`Fee Quoter Program: ${config.feeQuoterProgramId.toString()}`);
      this.logger.info(`RMN Remote Program: ${config.rmnRemoteProgramId.toString()}`);

      this.logger.info("");
      this.logger.info("📝 USAGE NOTES");
      this.logger.info("=========================================");
      this.logger.info("• Router Program ID: The main CCIP router program");
      this.logger.info("• State PDA: Program-derived address for router state");
      this.logger.info("• State PDA is derived deterministically from router program");
      this.logger.info("• Use these addresses for program interactions and debugging");

      this.logger.info("");
      this.logger.info("🎉 State Address Derivation Complete!");
      this.logger.info("✅ Addresses calculated successfully");

    } catch (error) {
      this.logger.error(
        `❌ Failed to get state addresses: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Export the functionality as functions for programmatic use
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
  const chainId = resolveNetworkToChainId(network);
  const config = getCCIPSVMConfig(chainId);
  return config;
}

// Create and run the command when executed directly
if (require.main === module) {
  const command = new GetStateAddressCommand();
  command.run().catch((error) => {
    process.exit(1);
  });
}