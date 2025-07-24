/**
 * EVM Token Drip/Faucet (CLI Framework Version)
 * 
 * This script demonstrates token dripping/faucet functionality for test tokens.
 * Get test tokens like BnM, LINK for development and testing purposes.
 * 
 * Professional CLI framework implementation with type safety,
 * argument validation, and consistent help formatting.
 */

import {
  CCIPCommand,
  ArgumentDefinition,
  CommandMetadata,
  BaseCommandOptions,
} from "../utils/cli-framework";
import { ethers } from "ethers";
import { ChainId, getEVMConfig } from "../../config";
import { formatBalance } from "../utils/provider";
// Import to ensure environment variables are loaded
import "../utils/config-parser";

/**
 * Options specific to the token drip command
 */
interface TokenDripOptions extends BaseCommandOptions {
  // Drip specific options
  sourceChain?: ChainId;
  recipientAddress?: string;
  dripAmount?: string;
  tokenAddress?: string;
  drips?: number;
}

/**
 * ABI for the Faucet contract
 */
const FAUCET_ABI = [
  {
    inputs: [
      { internalType: "address", name: "initialTokenAddress", type: "address" },
      { internalType: "uint256", name: "initialDripAmount", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "InvalidDripAmount",
    type: "error",
  },
  { inputs: [], name: "TokenAddressCannotBeZero", type: "error" },
  { inputs: [], name: "TokenMintFailed", type: "error" },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "newAmount",
        type: "uint256",
      },
    ],
    name: "DripAmountUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "TokensDripped",
    type: "event",
  },
  {
    inputs: [],
    name: "drip",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "dripAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "to", type: "address" }],
    name: "dripTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "token",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "newAmount", type: "uint256" }],
    name: "updateDripAmount",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

/**
 * Token Drip Command Implementation
 */
class TokenDripCommand extends CCIPCommand<TokenDripOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "token-drip",
      description:
        "🚰 EVM Token Drip/Faucet\n\nGet test tokens like BnM, LINK for development and testing. Perfect for acquiring tokens needed for CCIP transfers and experimentation.",
      examples: [
        "# Drip BnM tokens to your wallet",
        "yarn evm:token:drip",
        "",
        "# Drip tokens to a specific address",
        "yarn evm:token:drip --recipient 0x742d35Cc6634C0532925a3b8D93ecda2e9d4bbf9",
        "",
        "# Drip LINK tokens instead of BnM",
        "yarn evm:token:drip --token 0x779877A7B0D9E8603169DdbD7836e478b4624789",
        "",
        "# Drip custom amount",
        "yarn evm:token:drip --amount 5000000000000000000",
        "",
        "# Drip from different chain",
        "yarn evm:token:drip --source-chain avalanche-fuji --log-level DEBUG",
      ],
      notes: [
        "Requires EVM_PRIVATE_KEY in environment variables",
        "Default source chain is Ethereum Sepolia",
        "Default token is BnM (testnet token for CCIP)",
        "Recipient defaults to your wallet address",
        "Faucet may have daily limits or cooldowns",
        "Only works with test tokens on testnets",
        "Check your balance before and after dripping",
      ],
    };

    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "source-chain",
        aliases: ["s"],
        type: "string",
        description: "Source chain to drip tokens from",
        defaultValue: ChainId.ETHEREUM_SEPOLIA,
        example: "ethereum-sepolia",
      },
      {
        name: "token",
        aliases: ["t"],
        type: "string",
        description: "Token address to drip (defaults to BnM)",
        example: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      },
      {
        name: "recipient",
        aliases: ["r"],
        type: "string",
        description: "Recipient address (defaults to your wallet)",
        example: "0x742d35Cc6634C0532925a3b8D93ecda2e9d4bbf9",
      },
      {
        name: "amount",
        aliases: ["a"],
        type: "string",
        description: "Amount to drip in wei (uses faucet default if not specified)",
        example: "1000000000000000000",
      },
      {
        name: "drips",
        aliases: ["d"],
        type: "number",
        description: "Number of drip operations to perform",
        defaultValue: 1,
        example: "2",
      },
    ];
  }

  /**
   * Get default token address for dripping based on source chain
   */
  private getDefaultTokenAddress(): string {
    const sourceChainConfig = getEVMConfig(this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA);
    return sourceChainConfig.bnmTokenAddress; // Default to BnM token
  }

  /**
   * Create provider and signer
   */
  private createProvider(sourceChain: ChainId): { provider: ethers.JsonRpcProvider; signer: ethers.Wallet } {
    const config = getEVMConfig(sourceChain);
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(this.options.privateKey!, provider);
    return { provider, signer };
  }

  protected async execute(): Promise<void> {
    this.logger.info("🚰 EVM Token Drip/Faucet");
    this.logger.info("=========================================");

    try {
      // Configuration
      const sourceChain = this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA;
      const sourceConfig = getEVMConfig(sourceChain);
      const tokenAddress = this.options.tokenAddress || this.getDefaultTokenAddress();

      // Create provider and signer
      const { provider, signer } = this.createProvider(sourceChain);
      const signerAddress = await signer.getAddress();
      const recipientAddress = this.options.recipientAddress || signerAddress;

      this.logger.info(`Source Chain: ${sourceChain}`);
      this.logger.info(`Token Address: ${tokenAddress}`);
      this.logger.info(`Signer Address: ${signerAddress}`);
      this.logger.info(`Recipient Address: ${recipientAddress}`);

      // Check if we have a faucet contract address
      if (!sourceConfig.faucetAddress) {
        throw new Error(`No faucet address configured for chain ${sourceChain}. Please add a faucetAddress to the chain configuration.`);
      }

      // Create faucet contract interface
      const faucetContract = new ethers.Contract(sourceConfig.faucetAddress, FAUCET_ABI, signer);

      this.logger.info("\n💰 Checking Pre-Drip Balance");
      this.logger.info("=========================================");

      // Check recipient's current token balance
      const tokenContract = new ethers.Contract(tokenAddress, [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
      ], provider);

      const preBalance: bigint = await tokenContract.balanceOf(recipientAddress);
      const tokenSymbol = await tokenContract.symbol();
      const tokenDecimals = await tokenContract.decimals();

      this.logger.info(`${tokenSymbol} Balance: ${formatBalance(preBalance, Number(tokenDecimals))} ${tokenSymbol}`);

      // Check faucet drip amount
      const faucetDripAmount = await faucetContract.dripAmount();
      this.logger.info(`Faucet Drip Amount: ${formatBalance(faucetDripAmount, Number(tokenDecimals))} ${tokenSymbol}`);

      // Get number of drips to perform
      const numberOfDrips = this.options.drips || 1;
      
      this.logger.info("\n🚰 Executing Token Drip");
      this.logger.info("=========================================");
      this.logger.info(`Performing ${numberOfDrips} drip operation${numberOfDrips > 1 ? 's' : ''}...`);

      let totalGasUsed = BigInt(0);
      const transactionHashes: string[] = [];

      // Execute multiple drips
      for (let i = 0; i < numberOfDrips; i++) {
        if (numberOfDrips > 1) {
          this.logger.info(`\n🚰 Drip ${i + 1}/${numberOfDrips}`);
        }

        // Execute the drip
        let tx;
        if (recipientAddress === signerAddress) {
          // Drip to self
          if (numberOfDrips === 1) {
            this.logger.info("Dripping tokens to your wallet...");
          } else {
            this.logger.info(`Dripping tokens to your wallet (${i + 1}/${numberOfDrips})...`);
          }
          tx = await faucetContract.drip();
        } else {
          // Drip to specific address
          if (numberOfDrips === 1) {
            this.logger.info(`Dripping tokens to ${recipientAddress}...`);
          } else {
            this.logger.info(`Dripping tokens to ${recipientAddress} (${i + 1}/${numberOfDrips})...`);
          }
          tx = await faucetContract.dripTo(recipientAddress);
        }

        this.logger.info(`Transaction submitted: ${tx.hash}`);
        transactionHashes.push(tx.hash);
        
        if (numberOfDrips === 1) {
          this.logger.info("Waiting for confirmation...");
        }

        // Wait for transaction confirmation
        const receipt = await tx.wait(2);

        if (numberOfDrips === 1) {
          this.logger.info("✅ Transaction confirmed!");
          this.logger.info(`Block Number: ${receipt.blockNumber}`);
          this.logger.info(`Gas Used: ${receipt.gasUsed.toString()}`);
        } else {
          this.logger.info(`✅ Drip ${i + 1} confirmed! Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`);
        }

        totalGasUsed += receipt.gasUsed;
      }

      // Summary for multiple drips
      if (numberOfDrips > 1) {
        this.logger.info(`\n📊 Multi-Drip Summary`);
        this.logger.info("=========================================");
        this.logger.info(`Total Operations: ${numberOfDrips}`);
        this.logger.info(`Total Gas Used: ${totalGasUsed.toString()}`);
        this.logger.info(`Transaction Hashes:`);
        transactionHashes.forEach((hash, index) => {
          this.logger.info(`  ${index + 1}. ${hash}`);
        });
      }

      // Check post-drip balance
      this.logger.info("\n📊 Post-Drip Balance");
      this.logger.info("=========================================");

      const postBalance: bigint = await tokenContract.balanceOf(recipientAddress);
      const balanceIncrease: bigint = postBalance - preBalance;

      this.logger.info(`New ${tokenSymbol} Balance: ${formatBalance(postBalance, Number(tokenDecimals))} ${tokenSymbol}`);
      this.logger.info(`Total Tokens Received: ${formatBalance(balanceIncrease, Number(tokenDecimals))} ${tokenSymbol}`);
      
      if (numberOfDrips > 1) {
        const tokensPerDrip = balanceIncrease / BigInt(numberOfDrips);
        this.logger.info(`Tokens Per Drip: ${formatBalance(tokensPerDrip, Number(tokenDecimals))} ${tokenSymbol}`);
      }

      // Balance information shown above provides transaction details

      this.logger.info("\n✅ Token Drip Complete!");
      this.logger.info("🎉 Test tokens successfully added to your wallet");

    } catch (error) {
      this.logger.error(
        `❌ Token drip failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      // Provide helpful error context
      if (error instanceof Error && error.message.includes("TokenMintFailed")) {
        this.logger.info("\n💡 Troubleshooting:");
        this.logger.info("• Faucet may be out of tokens or have daily limits");
        this.logger.info("• Try again later or use a different faucet");
        this.logger.info("• Check if you've already dripped recently");
      }

      throw error;
    }
  }
}

// Create and run the command when executed directly
if (require.main === module) {
  const command = new TokenDripCommand();
  command.run().catch((error) => {
    process.exit(1);
  });
}

export { TokenDripCommand };