/**
 * Chain Remote Configuration Initialization Script (CLI Framework Version)
 *
 * This script initializes a chain remote configuration for a burn-mint token pool,
 * enabling cross-chain token transfers to a specific remote chain.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { ChainId, CHAIN_SELECTORS, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for init chain remote config operations
 */
const INIT_CHAIN_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the init-chain-remote-config command
 */
interface InitChainRemoteConfigOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
  remoteChain: string;
  tokenAddress: string;
  decimals: number;
}

/**
 * Init Chain Remote Configuration Command
 */
class InitChainRemoteConfigCommand extends CCIPCommand<InitChainRemoteConfigOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "init-chain-remote-config",
      description: "🔗 Chain Remote Configuration Initializer\n\nInitializes a chain remote configuration for a burn-mint token pool, enabling cross-chain token transfers to a specific remote chain.",
      examples: [
        "# Initialize chain config for Ethereum Sepolia",
        "yarn svm:pool:init-chain-remote-config --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain ethereum-sepolia --token-address \"0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c\" --decimals 6",
        "",
        "# Initialize chain config for Base Sepolia",
        "yarn svm:pool:init-chain-remote-config --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain base-sepolia --token-address \"0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c\" --decimals 6"
      ],
      notes: [
        `Minimum ${INIT_CHAIN_CONFIG.minSolRequired} SOL required for transaction fees`,
        "The token pool must already exist before configuring chains",
        "Wallet must be the pool administrator",
        "Addresses should be provided as hex strings with '0x' prefix",
        "Pool addresses are NOT provided during initialization (required by Rust program)",
        "Use 'yarn svm:pool:edit-chain-remote-config' to add pool addresses after initialization",
        "Remote chains: ethereum-sepolia, avalanche-fuji, base-sepolia, etc.",
        "Chain configuration initialization requires SOL for transaction fees"
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
        description: "Remote chain to configure (chain-id)",
        example: "ethereum-sepolia"
      },
      {
        name: "token-address",
        required: true,
        type: "string",
        description: "Token address on remote chain (hex)",
        example: "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c"
      },
      {
        name: "decimals",
        required: true,
        type: "number",
        description: "Token decimals on remote chain",
        example: "6"
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

  protected async execute(): Promise<void> {
    this.logger.info("🔗 CCIP Chain Remote Configuration Initialization");
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

    if (solBalance < INIT_CHAIN_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${INIT_CHAIN_CONFIG.minSolRequired} SOL for transaction fees.\n` +
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

    const tokenAddress = this.options.tokenAddress;
    const decimals = this.options.decimals;

    // Validate hex address
    const hexRegex = /^0x[a-fA-F0-9]+$/;
    if (!hexRegex.test(tokenAddress)) {
      throw new Error(`Invalid hex token address format: ${tokenAddress}. Must start with '0x' and contain only hex characters.`);
    }

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 INITIALIZATION CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Remote Chain: ${this.options.remoteChain}`);
    this.logger.info(`Remote Chain Selector: ${remoteChainSelector.toString()}`);
    this.logger.info(`Token Address: ${tokenAddress}`);
    this.logger.info(`Decimals: ${decimals}`);

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

      // Initialize the chain remote config (pool addresses must be empty for initialization)
      this.logger.info("");
      this.logger.info("🔧 INITIALIZING CHAIN REMOTE CONFIG");
      this.logger.info("==========================================");
      this.logger.info("Creating chain remote configuration...");
      this.logger.info("Note: Pool addresses will be empty initially");

      const result = await tokenPoolClient.initChainRemoteConfig(tokenMint, remoteChainSelector, {
        tokenAddress,
        decimals,
        txOptions: {
          skipPreflight: this.options.skipPreflight,
        },
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ CHAIN CONFIG INITIALIZED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${result.signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, result.signature)}`);

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("1. View configuration details:");
      this.logger.info(`   yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`);
      this.logger.info("");
      this.logger.info("2. Add pool addresses to enable cross-chain transfers:");
      this.logger.info(`   yarn svm:pool:edit-chain-remote-config --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()} --remote-chain ${this.options.remoteChain} --pool-addresses "0x..." --token-address "${tokenAddress}" --decimals ${decimals}`);

      this.logger.info("");
      this.logger.info("🎉 Chain Configuration Initialization Complete!");
      this.logger.info(`✅ Remote chain ${this.options.remoteChain} configuration created`);
      this.logger.info(`✅ Token address and decimals configured`);
      this.logger.info(`⚠️  Pool addresses must be added before transfers can occur`);
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to initialize chain remote configuration: ${error instanceof Error ? error.message : String(error)}`
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
const command = new InitChainRemoteConfigCommand();
command.run().catch((error) => {
  process.exit(1);
});