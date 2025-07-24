/**
 * Set Rate Limit Script (CLI Framework Version)
 *
 * This script configures inbound and outbound rate limits for a burn-mint token pool
 * on a specific remote chain. Rate limits control the maximum token transfer capacity
 * and refill rate to manage cross-chain transfer risks.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { ChainId, CHAIN_SELECTORS, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for rate limit operations
 */
const RATE_LIMIT_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the set-rate-limit command
 */
interface SetRateLimitOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
  remoteChain: string;
  inboundEnabled: boolean;
  inboundCapacity: string;
  inboundRate: string;
  outboundEnabled: boolean;
  outboundCapacity: string;
  outboundRate: string;
}

/**
 * Set Rate Limit Command
 */
class SetRateLimitCommand extends CCIPCommand<SetRateLimitOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "set-rate-limit",
      description: "⚡ Rate Limit Configuration Manager\n\nConfigure inbound and outbound rate limits for a burn-mint token pool on a specific remote chain. Rate limits control the maximum token transfer capacity and refill rate to manage cross-chain transfer risks.",
      examples: [
        "# Set rate limits for Ethereum Sepolia",
        "yarn svm:pool:set-rate-limit --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain ethereum-sepolia --inbound-enabled true --inbound-capacity 1000000000000000000 --inbound-rate 100000000000000000 --outbound-enabled true --outbound-capacity 500000000000000000 --outbound-rate 50000000000000000",
        "",
        "# Disable inbound rate limiting, keep outbound active",
        "yarn svm:pool:set-rate-limit --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain ethereum-sepolia --inbound-enabled false --inbound-capacity 0 --inbound-rate 0 --outbound-enabled true --outbound-capacity 1000000000000000000 --outbound-rate 100000000000000000",
        "",
        "# Set conservative rate limits for production",
        "yarn svm:pool:set-rate-limit --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain ethereum-sepolia --inbound-enabled true --inbound-capacity 10000000000000000000 --inbound-rate 1000000000000000000 --outbound-enabled true --outbound-capacity 10000000000000000000 --outbound-rate 1000000000000000000"
      ],
      notes: [
        `Minimum ${RATE_LIMIT_CONFIG.minSolRequired} SOL required for transaction fees`,
        "The token pool and chain configuration must already exist",
        "Wallet must be the pool owner or rate limit admin",
        "Capacity and rate values are in token's smallest unit (e.g., wei for 18-decimal tokens)",
        "Rate is tokens per second that refill the bucket",
        "Capacity is the maximum bucket size (burst limit)",
        "Setting enabled=false disables rate limiting for that direction",
        "Inbound = tokens coming FROM the remote chain TO Solana",
        "Outbound = tokens going FROM Solana TO the remote chain",
        "Use 'yarn svm:pool:get-info' to view current rate limits"
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
        description: "Remote chain to configure rate limits for (chain-id)",
        example: "ethereum-sepolia"
      },
      {
        name: "inbound-enabled",
        required: true,
        type: "boolean",
        description: "Enable inbound rate limiting (tokens FROM remote chain TO Solana)",
        example: "true"
      },
      {
        name: "inbound-capacity",
        required: true,
        type: "string",
        description: "Inbound rate limit capacity (bucket size in token's smallest unit)",
        example: "1000000000000000000"
      },
      {
        name: "inbound-rate",
        required: true,
        type: "string",
        description: "Inbound refill rate (tokens per second in token's smallest unit)",
        example: "100000000000000000"
      },
      {
        name: "outbound-enabled",
        required: true,
        type: "boolean",
        description: "Enable outbound rate limiting (tokens FROM Solana TO remote chain)",
        example: "true"
      },
      {
        name: "outbound-capacity",
        required: true,
        type: "string",
        description: "Outbound rate limit capacity (bucket size in token's smallest unit)",
        example: "500000000000000000"
      },
      {
        name: "outbound-rate",
        required: true,
        type: "string",
        description: "Outbound refill rate (tokens per second in token's smallest unit)",
        example: "50000000000000000"
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
   * Validate and parse numeric string values
   */
  private parseTokenAmount(value: string, fieldName: string): bigint {
    try {
      const parsed = BigInt(value);
      if (parsed < 0n) {
        throw new Error(`${fieldName} cannot be negative`);
      }
      return parsed;
    } catch (error) {
      throw new Error(`Invalid ${fieldName}: ${value}. Must be a valid non-negative integer.`);
    }
  }

  /**
   * Format token amount for display
   */
  private formatTokenAmount(amount: bigint, decimals: number = 18): string {
    if (amount === 0n) return "0";
    
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const remainder = amount % divisor;
    
    if (remainder === 0n) {
      return whole.toString();
    }
    
    const fractional = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fractional}`;
  }

  protected async execute(): Promise<void> {
    this.logger.info("⚡ CCIP Rate Limit Configuration Manager");
    this.logger.info("==========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("==========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < RATE_LIMIT_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${RATE_LIMIT_CONFIG.minSolRequired} SOL for transaction fees.\n` +
        `Current balance: ${solBalance.toFixed(9)} SOL\n\n` +
        `Request airdrop with:\n` +
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
    }

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

    // Parse and validate rate limit values
    const inboundCapacity = this.parseTokenAmount(this.options.inboundCapacity, "inbound capacity");
    const inboundRate = this.parseTokenAmount(this.options.inboundRate, "inbound rate");
    const outboundCapacity = this.parseTokenAmount(this.options.outboundCapacity, "outbound capacity");
    const outboundRate = this.parseTokenAmount(this.options.outboundRate, "outbound rate");

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 RATE LIMIT CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Remote Chain: ${this.options.remoteChain}`);
    this.logger.info(`Remote Chain Selector: ${remoteChainSelector.toString()}`);
    this.logger.info("");
    this.logger.info("📥 INBOUND RATE LIMITS (Remote → Solana):");
    this.logger.info(`  Enabled: ${this.options.inboundEnabled}`);
    this.logger.info(`  Capacity: ${inboundCapacity.toString()} (${this.formatTokenAmount(inboundCapacity)} tokens)`);
    this.logger.info(`  Rate: ${inboundRate.toString()} (${this.formatTokenAmount(inboundRate)} tokens/sec)`);
    this.logger.info("");
    this.logger.info("📤 OUTBOUND RATE LIMITS (Solana → Remote):");
    this.logger.info(`  Enabled: ${this.options.outboundEnabled}`);
    this.logger.info(`  Capacity: ${outboundCapacity.toString()} (${this.formatTokenAmount(outboundCapacity)} tokens)`);
    this.logger.info(`  Rate: ${outboundRate.toString()} (${this.formatTokenAmount(outboundRate)} tokens/sec)`);

    this.logger.debug("Configuration details:");
    this.logger.debug(`  Network: ${config.id}`);
    this.logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`  Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`  Skip preflight: ${this.options.skipPreflight}`);

    try {
      // Create token pool manager using SDK
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

      // Set the rate limits
      this.logger.info("");
      this.logger.info("⚡ SETTING RATE LIMITS");
      this.logger.info("==========================================");
      this.logger.info("Configuring rate limits...");

      const signature = await tokenPoolClient.setRateLimit(tokenMint, remoteChainSelector, {
        inbound: {
          enabled: this.options.inboundEnabled,
          capacity: inboundCapacity,
          rate: inboundRate,
        },
        outbound: {
          enabled: this.options.outboundEnabled,
          capacity: outboundCapacity,
          rate: outboundRate,
        },
        txOptions: {
          skipPreflight: this.options.skipPreflight,
        },
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ RATE LIMITS CONFIGURED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("View updated configuration:");
      this.logger.info(`  yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`);

      this.logger.info("");
      this.logger.info("🎉 Rate Limit Configuration Complete!");
      this.logger.info(`✅ Rate limits configured for chain ${this.options.remoteChain}`);
      this.logger.info(`✅ Inbound: ${this.options.inboundEnabled ? "Enabled" : "Disabled"}`);
      this.logger.info(`✅ Outbound: ${this.options.outboundEnabled ? "Enabled" : "Disabled"}`);
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to set rate limits: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new SetRateLimitCommand();
command.run().catch((error) => {
  process.exit(1);
});