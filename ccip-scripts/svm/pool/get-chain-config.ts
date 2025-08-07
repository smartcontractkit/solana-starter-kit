/**
 * Chain Configuration Retrieval Script (CLI Framework Version)
 *
 * This script retrieves and displays the chain remote configuration for a burn-mint token pool,
 * showing the configuration details for cross-chain token transfers to a specific remote chain.
 */

import { PublicKey } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { ChainId, CHAIN_SELECTORS, resolveNetworkConfig } from "../../config";
import { loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for get chain config operations
 */
const GET_CHAIN_CONFIG_CONFIG = {
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the get-chain-config command
 */
interface GetChainConfigOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
  remoteChain: string;
}

/**
 * Get Chain Configuration Command
 */
class GetChainConfigCommand extends CCIPCommand<GetChainConfigOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "get-chain-config",
      description: "🔍 Chain Configuration Reader\n\nRetrieves and displays the chain remote configuration for a burn-mint token pool, showing the configuration details for cross-chain token transfers to a specific remote chain.",
      examples: [
        "# Get chain config for Ethereum Sepolia",
        "yarn svm:pool:get-chain-config --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain ethereum-sepolia",
        "",
        "# Get chain config with debug logging",
        "yarn svm:pool:get-chain-config --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain base-sepolia --log-level DEBUG"
      ],
      notes: [
        "This is a READ-ONLY operation that doesn't require a wallet/keypair",
        "No transaction fees or signatures needed",
        "The token pool and chain configuration must already exist",
        "Shows detailed configuration including rate limits and current usage",
        "Remote chains: ethereum-sepolia, avalanche-fuji, base-sepolia, etc.",
        "Use this before editing configurations to see current values",
        "Shows token address, decimals, pool addresses, and rate limits"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "token-mint",
        required: true,
        type: "string",
        description: "Token mint address of existing pool",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      },
      {
        name: "remote-chain",
        required: true,
        type: "string",
        description: "Remote chain to query (chain-id)",
        example: "ethereum-sepolia"
      }
    ];
  }

  /**
   * Resolve remote chain selector from chain ID
   */
  private resolveRemoteChainSelector(remoteChain: string): bigint {
    const chainSelector = CHAIN_SELECTORS[remoteChain as ChainId];
    if (!chainSelector) {
      throw new Error(
        `Unknown remote chain: ${remoteChain}\n` +
        `Available chains: ${Object.keys(CHAIN_SELECTORS).join(", ")}`
      );
    }
    return chainSelector;
  }

  /**
   * Display available remote chains
   */
  private displayAvailableChains(): void {
    this.logger.info("");
    this.logger.info("📋 AVAILABLE REMOTE CHAINS");
    this.logger.info("==========================================");
    Object.entries(CHAIN_SELECTORS).forEach(([chainId, selector]) => {
      this.logger.info(`  ${chainId}: ${selector.toString()}`);
    });
  }

  /**
   * Format token amount for display
   */
  private formatTokenAmount(amount: bigint, decimals: number = 18): string {
    if (amount === BigInt(0)) return "0";
    
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const remainder = amount % divisor;
    
    if (remainder === BigInt(0)) {
      return whole.toString();
    }
    
    const fractional = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fractional}`;
  }

  /**
   * Display chain configuration details
   */
  private displayChainConfig(chainConfig: any): void {
    this.logger.info("");
    this.logger.info("📋 CHAIN CONFIGURATION DETAILS");
    this.logger.info("==========================================");
    this.logger.info(`Account Address: ${chainConfig.address}`);
    
    this.logger.info("");
    this.logger.info("🔗 REMOTE CHAIN INFORMATION");
    this.logger.info("------------------------------------------");
    this.logger.info(`Decimals: ${chainConfig.base.decimals}`);
    this.logger.info(`Token Address: 0x${chainConfig.base.tokenAddress.address}`);
    
    this.logger.info("");
    this.logger.info("🏊 POOL ADDRESSES");
    this.logger.info("------------------------------------------");
    if (chainConfig.base.poolAddresses.length === 0) {
      this.logger.info("No pool addresses configured");
    } else {
      chainConfig.base.poolAddresses.forEach((pool: any, index: number) => {
        this.logger.info(`${index + 1}. 0x${pool.address}`);
      });
    }
    
    this.logger.info("");
    this.logger.info("⬇️  INBOUND RATE LIMIT");
    this.logger.info("------------------------------------------");
    this.logger.info(`Enabled: ${chainConfig.base.inboundRateLimit.isEnabled}`);
    this.logger.info(`Capacity: ${chainConfig.base.inboundRateLimit.capacity.toString()} (${this.formatTokenAmount(BigInt(chainConfig.base.inboundRateLimit.capacity), chainConfig.base.decimals)} tokens)`);
    this.logger.info(`Rate: ${chainConfig.base.inboundRateLimit.rate.toString()} (${this.formatTokenAmount(BigInt(chainConfig.base.inboundRateLimit.rate), chainConfig.base.decimals)} tokens/second)`);
    this.logger.info(`Current Bucket Value: ${chainConfig.base.inboundRateLimit.currentBucketValue.toString()} (${this.formatTokenAmount(BigInt(chainConfig.base.inboundRateLimit.currentBucketValue), chainConfig.base.decimals)} tokens)`);
    this.logger.info(`Last Updated: ${new Date(
      Number(chainConfig.base.inboundRateLimit.lastTxTimestamp) * 1000
    ).toISOString()}`);
    
    this.logger.info("");
    this.logger.info("⬆️  OUTBOUND RATE LIMIT");
    this.logger.info("------------------------------------------");
    this.logger.info(`Enabled: ${chainConfig.base.outboundRateLimit.isEnabled}`);
    this.logger.info(`Capacity: ${chainConfig.base.outboundRateLimit.capacity.toString()} (${this.formatTokenAmount(BigInt(chainConfig.base.outboundRateLimit.capacity), chainConfig.base.decimals)} tokens)`);
    this.logger.info(`Rate: ${chainConfig.base.outboundRateLimit.rate.toString()} (${this.formatTokenAmount(BigInt(chainConfig.base.outboundRateLimit.rate), chainConfig.base.decimals)} tokens/second)`);
    this.logger.info(`Current Bucket Value: ${chainConfig.base.outboundRateLimit.currentBucketValue.toString()} (${this.formatTokenAmount(BigInt(chainConfig.base.outboundRateLimit.currentBucketValue), chainConfig.base.decimals)} tokens)`);
    this.logger.info(`Last Updated: ${new Date(
      Number(chainConfig.base.outboundRateLimit.lastTxTimestamp) * 1000
    ).toISOString()}`);
  }

  protected async execute(): Promise<void> {
    this.logger.info("🔍 CCIP Chain Configuration Reader (Read-Only)");
    this.logger.info("==========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Parse and validate addresses
    let tokenMint: PublicKey;
    let burnMintPoolProgramId: PublicKey;
    
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch {
      throw new Error(`Invalid token mint address: ${this.options.tokenMint}`);
    }
    
    try {
      burnMintPoolProgramId = new PublicKey(this.options.burnMintPoolProgram);
    } catch {
      throw new Error(`Invalid burn-mint pool program ID: ${this.options.burnMintPoolProgram}`);
    }

    // Resolve remote chain selector
    let remoteChainSelector: bigint;
    try {
      remoteChainSelector = this.resolveRemoteChainSelector(this.options.remoteChain);
    } catch (error) {
      this.displayAvailableChains();
      throw error;
    }

    // Display query parameters
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Remote Chain: ${this.options.remoteChain}`);
    this.logger.info(`Remote Chain Selector: ${remoteChainSelector.toString()}`);

    this.logger.debug("Configuration details:");
    this.logger.debug(`  Network: ${config.id}`);
    this.logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`  Commitment level: ${config.connection.commitment}`);

    try {
      // Create token pool manager using SDK (using dummy wallet for read operations)
      const walletKeypair = loadKeypair(`${process.env.HOME}/.config/solana/id.json`);
      const tokenPoolManager = TokenPoolManager.create(
        config.connection,
        walletKeypair,
        {
          burnMint: burnMintPoolProgramId,
        },
        {
          ccipRouterProgramId: config.routerProgramId.toString(),
          feeQuoterProgramId: config.feeQuoterProgramId.toString(),
          rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
          linkTokenMint: config.linkTokenMint.toString(),
          receiverProgramId: config.receiverProgramId.toString(),
        },
        { logLevel: this.options.logLevel ?? LogLevel.INFO }
      );

      const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

      // Get the chain config
      this.logger.info("");
      this.logger.info("🔄 RETRIEVING CHAIN CONFIGURATION");
      this.logger.info("==========================================");
      this.logger.info("Fetching chain configuration...");
      
      const chainConfig = await tokenPoolClient.getChainConfig(tokenMint, remoteChainSelector);

      // Display the configuration
      this.displayChainConfig(chainConfig);

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("• Use edit-chain-remote-config to update this configuration");
      this.logger.info("• Use set-rate-limit to update rate limits separately");
      this.logger.info("• Use get-pool-info to see all chain configurations");

      this.logger.info("");
      this.logger.info("🎉 Chain Configuration Retrieved Successfully!");
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve chain configuration: ${error instanceof Error ? error.message : String(error)}`
      );

      this.logger.info("");
      this.logger.info("❌ COMMON ISSUES");
      this.logger.info("==========================================");
      this.logger.info("• Chain configuration does not exist for this remote chain");
      this.logger.info("• Token pool does not exist for this mint");
      this.logger.info("• Invalid remote chain selector");

      this.logger.info("");
      this.logger.info("💡 SOLUTIONS");
      this.logger.info("==========================================");
      this.logger.info("• Use init-chain-remote-config to create the configuration first");
      this.logger.info("• Use get-pool-info to verify the pool exists");
      this.logger.info("• Check available chains with --help");

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new GetChainConfigCommand();
command.run().catch((error) => {
  process.exit(1);
});