/**
 * Token Creation Utilities for SPL Token and Token-2022 with Metadata
 *
 * This module provides utilities for creating and managing SPL Token and Token-2022 tokens
 * with Metaplex metadata support, following the established patterns of the CCIP library.
 */

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  Umi,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey as umiPublicKey,
  PublicKey as UmiPublicKey,
  Signer,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { createUmi as createUmiInstance } from "@metaplex-foundation/umi-bundle-defaults";
import {
  mplTokenMetadata,
  createV1,
  mintV1,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  findAssociatedTokenPda,
  mplToolbox,
  createAssociatedToken,
} from "@metaplex-foundation/mpl-toolbox";
import { createLogger, LogLevel } from "./logger";
import { detectTokenProgram } from "./token";

/**
 * Supported token programs
 */
export enum TokenProgram {
  /** Legacy SPL Token Program */
  SPL_TOKEN = "spl-token",
  /** Token-2022 Program with Extensions */
  TOKEN_2022 = "token-2022",
}

/**
 * Token metadata structure following Metaplex standards
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  externalUrl?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * Base configuration for token creation
 */
export interface BaseTokenConfig {
  /** Token name (max 32 chars) */
  name: string;
  /** Token symbol (max 10 chars) */
  symbol: string;
  /** Metadata URI pointing to JSON metadata */
  uri: string;
  /** Number of decimal places (0-9) */
  decimals: number;
  /** Initial supply to mint (optional, defaults to 0) */
  initialSupply?: bigint;
  /** Seller fee basis points (0-10000, optional, defaults to 0) */
  sellerFeeBasisPoints?: number;
  /** Token program to use */
  tokenProgram: TokenProgram;
}

/**
 * Configuration for creating an SPL token
 */
export interface SplTokenConfig extends Omit<BaseTokenConfig, "tokenProgram"> {
  tokenProgram: TokenProgram.SPL_TOKEN;
}

/**
 * Configuration for creating a Token-2022 token
 */
export interface Token2022Config extends Omit<BaseTokenConfig, "tokenProgram"> {
  tokenProgram: TokenProgram.TOKEN_2022;
}

/**
 * Union type for all token configurations
 */
export type TokenConfig = SplTokenConfig | Token2022Config;

/**
 * Result of token creation operation
 */
export interface TokenCreationResult {
  /** The mint address of the created token */
  mint: PublicKey;
  /** Transaction signature */
  signature: string;
  /** Associated token account address (if initial supply > 0) */
  tokenAccount?: PublicKey;
  /** Metaplex Umi mint signer for additional operations */
  mintSigner: Signer;
}

/**
 * Result of token minting operation
 */
export interface MintResult {
  /** Transaction signature */
  signature: string;
  /** Amount minted */
  amount: bigint;
  /** Token account address */
  tokenAccount: PublicKey;
  /** New token balance */
  newBalance: string;
}

/**
 * Options for token operations
 */
export interface TokenOperationOptions {
  /** Skip transaction preflight checks */
  skipPreflight?: boolean;
  /** Transaction commitment level */
  commitment?: "processed" | "confirmed" | "finalized";
  /** Logging level for operations */
  logLevel?: LogLevel;
}

/**
 * Core utilities for Token-2022 operations
 */
export class TokenCreationUtils {
  private umi: Umi;
  private connection: Connection;
  private logger: any;

  constructor(
    connection: Connection,
    keypair: Keypair,
    logLevel: LogLevel = LogLevel.INFO
  ) {
    this.connection = connection;
    this.logger = createLogger("token-creation-utils", { level: logLevel });

    this.logger.debug("Initializing TokenCreationUtils", {
      rpcEndpoint: connection.rpcEndpoint,
      authority: keypair.publicKey.toString(),
    });

    // Create Umi instance with the provided connection and keypair
    this.umi = createUmiInstance(connection.rpcEndpoint)
      .use(mplTokenMetadata())
      .use(mplToolbox())
      .use(
        keypairIdentity({
          publicKey: umiPublicKey(keypair.publicKey.toBase58()),
          secretKey: keypair.secretKey,
        })
      );

    this.logger.trace("Umi instance created with plugins", {
      identity: this.umi.identity.publicKey,
    });
  }

  /**
   * Create a new token with metadata (supports both SPL Token and Token-2022)
   */
  async createTokenWithMetadata(
    config: TokenConfig,
    options: TokenOperationOptions = {}
  ): Promise<TokenCreationResult> {
    this.logger.info(`Starting ${config.tokenProgram} creation with metadata`, {
      name: config.name,
      symbol: config.symbol,
      decimals: config.decimals,
      uri: config.uri,
      initialSupply: config.initialSupply?.toString(),
      sellerFeeBasisPoints: config.sellerFeeBasisPoints,
      tokenProgram: config.tokenProgram,
    });

    // Validate configuration
    this.validateTokenConfig(config);
    this.logger.debug("Token configuration validated successfully");

    // Generate mint signer
    const mint = generateSigner(this.umi);

    // Get the appropriate token program ID
    const tokenProgramId =
      config.tokenProgram === TokenProgram.TOKEN_2022
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
    const tokenProgram = umiPublicKey(tokenProgramId.toString());

    this.logger.debug("Generated mint keypair", {
      mint: mint.publicKey,
      tokenProgram: tokenProgram,
    });

    try {
      // Create the token with metadata
      this.logger.debug("Building createV1 transaction", {
        authority: this.umi.identity.publicKey,
        tokenStandard: "Fungible",
      });

      const createTx = createV1(this.umi, {
        mint,
        authority: this.umi.identity,
        name: config.name,
        symbol: config.symbol,
        uri: config.uri,
        sellerFeeBasisPoints: percentAmount(config.sellerFeeBasisPoints || 0),
        decimals: config.decimals,
        splTokenProgram: tokenProgram,
        tokenStandard: TokenStandard.Fungible,
      });

      this.logger.debug("Sending token creation transaction", {
        commitment: options.commitment || "finalized",
        skipPreflight: options.skipPreflight || false,
      });

      const signature = await createTx.sendAndConfirm(this.umi, {
        confirm: { commitment: options.commitment || "finalized" },
        send: { skipPreflight: options.skipPreflight || false },
      });

      this.logger.info(`${config.tokenProgram} token created successfully`, {
        mint: mint.publicKey,
        signature: base58.deserialize(signature.signature)[0],
      });

      const result: TokenCreationResult = {
        mint: new PublicKey(mint.publicKey),
        signature: base58.deserialize(signature.signature)[0],
        mintSigner: mint,
      };

      // If initial supply is specified, mint tokens to creator
      if (config.initialSupply && config.initialSupply > 0) {
        this.logger.debug("Minting initial supply", {
          amount: config.initialSupply.toString(),
          recipient: this.umi.identity.publicKey,
        });

        const mintResult = await this.mintToAssociatedAccount(
          new PublicKey(mint.publicKey),
          config.initialSupply,
          this.umi.identity.publicKey,
          tokenProgramId,
          options
        );
        result.tokenAccount = mintResult.tokenAccount;

        this.logger.info("Initial supply minted", {
          tokenAccount: result.tokenAccount?.toString(),
          amount: config.initialSupply.toString(),
        });
      }

      return result;
    } catch (error) {
      this.logger.error("Failed to create Token-2022", {
        error: error instanceof Error ? error.message : String(error),
        config,
        mint: mint.publicKey,
      });
      throw new Error(
        `Failed to create ${config.tokenProgram} token: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Mint tokens to an associated token account
   */
  async mintToAssociatedAccount(
    mint: PublicKey,
    amount: bigint,
    recipient?: PublicKey | UmiPublicKey,
    tokenProgramId?: PublicKey,
    options: TokenOperationOptions = {}
  ): Promise<MintResult> {
    // If no token program specified, detect it from the mint
    const resolvedTokenProgramId = tokenProgramId || await detectTokenProgram(mint, this.connection, this.logger);
    
    const tokenProgram = umiPublicKey(resolvedTokenProgramId.toString());
    const mintPubkey = umiPublicKey(mint.toString());
    const recipientKey = recipient
      ? typeof recipient === "string" || "toBase58" in recipient
        ? umiPublicKey(recipient.toString())
        : recipient
      : this.umi.identity.publicKey;

    this.logger.info("Starting token mint operation", {
      mint: mint.toString(),
      amount: amount.toString(),
      recipient: recipientKey.toString(),
    });

    try {
      // Find or create the associated token account
      this.logger.debug("Finding or creating ATA", {
        mint: mint.toString(),
        owner: recipientKey.toString(),
      });

      const tokenAccount = await this.findOrCreateATA(
        mint,
        recipientKey,
        tokenProgramId,
        options
      );

      this.logger.debug("ATA resolved for minting", {
        tokenAccount: tokenAccount.toString(),
      });

      // Mint tokens
      this.logger.debug("Building mintV1 transaction", {
        authority: this.umi.identity.publicKey,
        amount: amount.toString(),
        tokenStandard: "Fungible",
      });

      const mintTx = mintV1(this.umi, {
        mint: mintPubkey,
        authority: this.umi.identity,
        amount: amount,
        token: umiPublicKey(tokenAccount.toString()),
        tokenOwner: recipientKey,
        tokenStandard: TokenStandard.Fungible,
        splTokenProgram: tokenProgram,
      });

      this.logger.debug("Sending mint transaction", {
        commitment: options.commitment || "finalized",
        skipPreflight: options.skipPreflight || false,
      });

      const signature = await mintTx.sendAndConfirm(this.umi, {
        confirm: { commitment: options.commitment || "finalized" },
        send: { skipPreflight: options.skipPreflight || false },
      });

      this.logger.debug("Mint transaction confirmed", {
        signature: signature.signature.toString(),
      });

      // Get updated balance
      this.logger.trace("Fetching updated token balance");
      const balance = await this.connection.getTokenAccountBalance(
        tokenAccount
      );

      this.logger.info("Tokens minted successfully", {
        signature: base58.deserialize(signature.signature)[0],
        amount: amount.toString(),
        tokenAccount: tokenAccount.toString(),
        newBalance: balance.value.amount,
      });

      return {
        signature: base58.deserialize(signature.signature)[0],
        amount,
        tokenAccount,
        newBalance: balance.value.amount,
      };
    } catch (error) {
      this.logger.error("Failed to mint tokens", {
        error: error instanceof Error ? error.message : String(error),
        mint: mint.toString(),
        amount: amount.toString(),
        recipient: recipientKey.toString(),
      });
      throw new Error(
        `Failed to mint tokens: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Find or create an associated token account
   */
  async findOrCreateATA(
    mint: PublicKey,
    owner: PublicKey | UmiPublicKey,
    tokenProgramId?: PublicKey,
    options: TokenOperationOptions = {}
  ): Promise<PublicKey> {
    // If no token program specified, detect it from the mint
    const resolvedTokenProgramId = tokenProgramId || await detectTokenProgram(mint, this.connection, this.logger);
    
    const tokenProgram = umiPublicKey(resolvedTokenProgramId.toString());
    const mintPubkey = umiPublicKey(mint.toString());
    const ownerKey =
      typeof owner === "string" || "toBase58" in owner
        ? umiPublicKey(owner.toString())
        : owner;

    this.logger.debug("Finding or creating ATA", {
      mint: mint.toString(),
      owner: ownerKey.toString(),
      tokenProgram: tokenProgram.toString(),
    });

    try {
      // Find the associated token account PDA
      const [tokenAccount] = findAssociatedTokenPda(this.umi, {
        mint: mintPubkey,
        owner: ownerKey,
        tokenProgramId: tokenProgram,
      });

      this.logger.trace("Calculated ATA PDA", {
        tokenAccount: tokenAccount.toString(),
      });

      // Check if the account exists
      this.logger.trace("Checking if ATA exists");
      const accountInfo = await this.connection.getAccountInfo(
        new PublicKey(tokenAccount)
      );

      if (!accountInfo) {
        this.logger.debug("ATA does not exist, creating new account", {
          tokenAccount: tokenAccount.toString(),
        });

        // Create the associated token account
        const createTx = createAssociatedToken(this.umi, {
          mint: mintPubkey,
          owner: ownerKey,
          ata: tokenAccount,
          tokenProgram: tokenProgram,
        });

        this.logger.debug("Sending ATA creation transaction", {
          commitment: options.commitment || "finalized",
          skipPreflight: options.skipPreflight || false,
        });

        const signature = await createTx.sendAndConfirm(this.umi, {
          confirm: { commitment: options.commitment || "finalized" },
          send: { skipPreflight: options.skipPreflight || false },
        });

        this.logger.info("ATA created successfully", {
          tokenAccount: tokenAccount.toString(),
          signature: base58.deserialize(signature.signature)[0],
        });
      } else {
        this.logger.debug("ATA already exists", {
          tokenAccount: tokenAccount.toString(),
        });
      }

      return new PublicKey(tokenAccount);
    } catch (error) {
      this.logger.error("Failed to find or create ATA", {
        error: error instanceof Error ? error.message : String(error),
        mint: mint.toString(),
        owner: ownerKey.toString(),
      });
      throw new Error(
        `Failed to find or create ATA: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get token account balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
    this.logger.trace("Fetching token account balance", {
      tokenAccount: tokenAccount.toString(),
    });

    try {
      const balance = await this.connection.getTokenAccountBalance(
        tokenAccount
      );

      this.logger.trace("Token balance retrieved", {
        tokenAccount: tokenAccount.toString(),
        amount: balance.value.amount,
        decimals: balance.value.decimals,
      });

      return BigInt(balance.value.amount);
    } catch (error) {
      this.logger.error("Failed to get token balance", {
        error: error instanceof Error ? error.message : String(error),
        tokenAccount: tokenAccount.toString(),
      });
      throw new Error(
        `Failed to get token balance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate token configuration
   */
  private validateTokenConfig(config: TokenConfig): void {
    this.logger.trace("Validating token configuration", { config });

    if (!config.name || config.name.length > 32) {
      this.logger.error("Invalid token name", {
        name: config.name,
        length: config.name?.length,
      });
      throw new Error("Token name must be between 1 and 32 characters");
    }
    if (!config.symbol || config.symbol.length > 10) {
      this.logger.error("Invalid token symbol", {
        symbol: config.symbol,
        length: config.symbol?.length,
      });
      throw new Error("Token symbol must be between 1 and 10 characters");
    }
    if (config.decimals < 0 || config.decimals > 9) {
      this.logger.error("Invalid token decimals", {
        decimals: config.decimals,
      });
      throw new Error("Token decimals must be between 0 and 9");
    }
    if (!config.uri) {
      this.logger.error("Missing metadata URI");
      throw new Error("Metadata URI is required");
    }
    if (
      config.sellerFeeBasisPoints &&
      (config.sellerFeeBasisPoints < 0 || config.sellerFeeBasisPoints > 10000)
    ) {
      this.logger.error("Invalid seller fee basis points", {
        sellerFeeBasisPoints: config.sellerFeeBasisPoints,
      });
      throw new Error("Seller fee basis points must be between 0 and 10000");
    }

    this.logger.trace("Token configuration validation passed");
  }
}
