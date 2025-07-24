/**
 * Chain Remote Configuration Edit Script (CLI Framework Version)
 *
 * This script edits an existing chain remote configuration for a burn-mint token pool,
 * updating the configuration for cross-chain token transfers to a specific remote chain.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { ChainId, CHAIN_SELECTORS, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for edit chain remote config operations
 */
const EDIT_CHAIN_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the edit-chain-remote-config command
 */
interface EditChainRemoteConfigOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
  remoteChain: string;
  poolAddresses: string;
  tokenAddress: string;
  decimals: number;
}

/**
 * Edit Chain Remote Configuration Command
 */
class EditChainRemoteConfigCommand extends CCIPCommand<EditChainRemoteConfigOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "edit-chain-remote-config",
      description: "🔗 Chain Remote Configuration Editor\n\nEdits an existing chain remote configuration for a burn-mint token pool, updating the configuration for cross-chain token transfers to a specific remote chain.",
      examples: [
        "# Edit chain config for Ethereum Sepolia",
        "yarn svm:pool:edit-chain-remote-config --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain ethereum-sepolia --pool-addresses \"0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d\" --token-address \"0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c\" --decimals 6",
        "",
        "# Edit with multiple pool addresses",
        "yarn svm:pool:edit-chain-remote-config --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --remote-chain ethereum-sepolia --pool-addresses \"0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d,0x123...\" --token-address \"0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c\" --decimals 6"
      ],
      notes: [
        `Minimum ${EDIT_CHAIN_CONFIG.minSolRequired} SOL required for transaction fees`,
        "The token pool and chain configuration must already exist",
        "Wallet must be the pool administrator",
        "Addresses should be provided as hex strings with '0x' prefix",
        "Multiple pool addresses can be separated by commas",
        "Chain configuration editing requires SOL for transaction fees",
        "Remote chains: ethereum-sepolia, avalanche-fuji, base-sepolia, etc.",
        "Use 'yarn svm:pool:get-info' to view current configuration"
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
        name: "pool-addresses",
        required: true,
        type: "string",
        description: "Comma-separated pool addresses on remote chain (hex)",
        example: "0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d"
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
    this.logger.info("🔗 CCIP Chain Remote Configuration Editor");
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

    if (solBalance < EDIT_CHAIN_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${EDIT_CHAIN_CONFIG.minSolRequired} SOL for transaction fees.\n` +
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

    // Parse pool addresses
    const poolAddresses = this.options.poolAddresses
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    if (poolAddresses.length === 0) {
      throw new Error("At least one pool address must be provided");
    }

    const tokenAddress = this.options.tokenAddress;
    const decimals = this.options.decimals;

    // Validate hex addresses
    const hexRegex = /^0x[a-fA-F0-9]+$/;
    poolAddresses.forEach((addr) => {
      if (!hexRegex.test(addr)) {
        throw new Error(`Invalid hex address format: ${addr}. Must start with '0x' and contain only hex characters.`);
      }
    });
    
    if (!hexRegex.test(tokenAddress)) {
      throw new Error(`Invalid hex token address format: ${tokenAddress}. Must start with '0x' and contain only hex characters.`);
    }

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 EDIT CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`Remote Chain: ${this.options.remoteChain}`);
    this.logger.info(`Remote Chain Selector: ${remoteChainSelector.toString()}`);
    this.logger.info(`Pool Addresses: ${poolAddresses.join(", ")}`);
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

      // Edit the chain remote config
      this.logger.info("");
      this.logger.info("🔧 EDITING CHAIN REMOTE CONFIG");
      this.logger.info("==========================================");
      this.logger.info("Updating chain remote configuration...");

      const result = await tokenPoolClient.editChainRemoteConfig(tokenMint, remoteChainSelector, {
        poolAddresses,
        tokenAddress,
        decimals,
        txOptions: {
          skipPreflight: this.options.skipPreflight,
        },
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ CHAIN CONFIG EDITED SUCCESSFULLY");
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
      this.logger.info("View updated configuration:");
      this.logger.info(`  yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`);

      this.logger.info("");
      this.logger.info("🎉 Chain Configuration Update Complete!");
      this.logger.info(`✅ Remote chain ${this.options.remoteChain} configuration updated`);
      this.logger.info(`✅ Pool addresses: ${poolAddresses.length} configured`);
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to edit chain remote configuration: ${error instanceof Error ? error.message : String(error)}`
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
const command = new EditChainRemoteConfigCommand();
command.run().catch((error) => {
  process.exit(1);
});