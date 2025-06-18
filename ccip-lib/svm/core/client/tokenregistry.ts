import {
  PublicKey,
  SystemProgram,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import { CCIPContext } from "../models";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import {
  executeTransaction,
  extractTxOptions,
  TransactionExecutionOptions,
} from "../../utils/transaction";
import { detectTokenProgram } from "../../utils/token";
import {
  findConfigPDA,
  findTokenAdminRegistryPDA,
  ROUTER_SEEDS,
} from "../../utils/pdas/router";
import { TxOptions } from "../../tokenpools/abstract";
import { TokenAdminRegistry } from "../../bindings/accounts/tokenAdminRegistry";
import {
  findBurnMintPoolConfigPDA,
  findPoolSignerPDA,
  TOKEN_POOL_STATE_SEED,
  TOKEN_POOL_POOL_SIGNER_SEED,
} from "../../utils/pdas/tokenpool";
import { findFqBillingTokenConfigPDA } from "../../utils/pdas/feeQuoter";
import { findExternalTokenPoolsSignerPDA } from "../../utils/pdas/router";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

// Import from bindings for ccip-router
import {
  ownerProposeAdministrator,
  acceptAdminRoleTokenAdminRegistry,
  transferAdminRoleTokenAdminRegistry,
  setPool,
  OwnerProposeAdministratorAccounts,
  OwnerProposeAdministratorArgs,
  AcceptAdminRoleTokenAdminRegistryAccounts,
  TransferAdminRoleTokenAdminRegistryAccounts,
  TransferAdminRoleTokenAdminRegistryArgs,
  SetPoolAccounts,
} from "../../bindings/instructions";

/**
 * Common base options extending TxOptions
 */
export interface TokenRegistryTxOptions extends TxOptions {}

/**
 * Options for proposing an administrator
 */
export interface ProposeAdministratorOptions extends TokenRegistryTxOptions {
  tokenMint: PublicKey;
  newAdmin: PublicKey;
}

/**
 * Options for accepting an admin role
 */
export interface AcceptAdminRoleOptions extends TokenRegistryTxOptions {
  tokenMint: PublicKey;
}

/**
 * Options for transferring an admin role
 */
export interface TransferAdminRoleOptions extends TokenRegistryTxOptions {
  tokenMint: PublicKey;
  newAdmin: PublicKey;
}

/**
 * Options for setting a pool
 */
export interface SetPoolOptions extends TokenRegistryTxOptions {
  tokenMint: PublicKey;
  lookupTable: PublicKey;
  writableIndices: number[];
}

/**
 * Options for creating a token pool lookup table
 */
export interface CreateTokenPoolLookupTableOptions
  extends TokenRegistryTxOptions {
  tokenMint: PublicKey;
  poolProgramId: PublicKey;
  feeQuoterProgramId: PublicKey;
  // tokenProgramId is now auto-detected, removed from interface
}

/**
 * Result of creating a token pool lookup table
 */
export interface CreateTokenPoolLookupTableResult {
  signature: string;
  lookupTableAddress: PublicKey;
  addresses: PublicKey[];
}

/**
 * Client for managing token registry administration
 * Used to register and manage token pools with the CCIP router
 */
export class TokenRegistryClient {
  private readonly logger: Logger;

  /**
   * Creates a new TokenRegistryClient
   * @param context CCIP context
   * @param routerProgramId CCIP Router program ID
   */
  constructor(
    readonly context: CCIPContext,
    readonly routerProgramId: PublicKey
  ) {
    this.logger =
      context.logger ??
      createLogger("token-registry-client", { level: LogLevel.INFO });
    this.logger.debug(
      `TokenRegistryClient initialized: routerProgramId=${this.routerProgramId.toString()}`
    );
  }

  /**
   * Retrieves the token admin registry account for a token
   *
   * @param tokenMint The mint of the token to fetch the registry for
   * @returns The token admin registry account if it exists, null otherwise
   */
  async getTokenAdminRegistry(
    tokenMint: PublicKey
  ): Promise<TokenAdminRegistry | null> {
    const errorContext = {
      operation: "getTokenAdminRegistry",
      mint: tokenMint.toString(),
    };

    try {
      this.logger.info(
        `Fetching token admin registry for mint: ${tokenMint.toString()}`
      );

      // Find the PDA for the token admin registry
      const [tokenAdminRegistryPDA, tokenAdminRegistryBump] =
        findTokenAdminRegistryPDA(tokenMint, this.routerProgramId);
      this.logger.debug(
        `Token Admin Registry PDA: ${tokenAdminRegistryPDA.toString()} (bump: ${tokenAdminRegistryBump})`
      );
      this.logger.trace(
        `Token Admin Registry PDA derivation: seeds=["${
          ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY
        }", ${tokenMint.toString()}], program=${this.routerProgramId.toString()}`
      );

      // Fetch the account using TokenAdminRegistry helper
      const tokenAdmin = await TokenAdminRegistry.fetch(
        this.context.provider.connection,
        tokenAdminRegistryPDA,
        this.routerProgramId
      );

      if (tokenAdmin) {
        this.logger.debug(
          `Token admin data retrieved for ${tokenMint.toString()}`
        );
      } else {
        this.logger.debug(
          `No token admin data found for ${tokenMint.toString()}`
        );
      }

      return tokenAdmin;
    } catch (error) {
      const enhanceError = createErrorEnhancer(this.logger);
      throw enhanceError(error, errorContext);
    }
  }

  /**
   * Proposes a new administrator for a token's registry.
   * Only the token owner (mint authority) can call this method.
   *
   * This is the first step in a two-step process to set or change
   * the administrator for a token. The proposed administrator must
   * call `acceptAdminRole` to complete the process.
   *
   * @param options Configuration options including token mint and proposed admin
   * @returns Promise resolving to the transaction signature
   * @throws Error if the caller is not the token owner or if the transaction fails
   */
  async proposeAdministrator(
    options: ProposeAdministratorOptions
  ): Promise<string> {
    const errorContext = {
      operation: "proposeAdministrator",
      mint: options.tokenMint.toString(),
      newAdmin: options.newAdmin.toString(),
    };

    try {
      this.logger.info(
        `Proposing administrator for token ${options.tokenMint.toString()}: new admin ${options.newAdmin.toString()}`
      );

      // Get signer and derive necessary PDAs
      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug("Propose administrator details:", {
        mint: options.tokenMint.toString(),
        newAdmin: options.newAdmin.toString(),
        signer: signerPublicKey.toString(),
        programId: this.routerProgramId.toString(),
      });

      // Use bindings to find PDAs
      const [tokenAdminRegistryPDA, tokenAdminRegistryBump] =
        findTokenAdminRegistryPDA(options.tokenMint, this.routerProgramId);
      this.logger.debug(
        `Token Admin Registry PDA: ${tokenAdminRegistryPDA.toString()} (bump: ${tokenAdminRegistryBump})`
      );
      this.logger.trace(
        `Token Admin Registry PDA derivation: seeds=["${
          ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY
        }", ${options.tokenMint.toString()}], program=${this.routerProgramId.toString()}`
      );

      const [configPDA, configBump] = findConfigPDA(this.routerProgramId);
      this.logger.debug(
        `Config PDA: ${configPDA.toString()} (bump: ${configBump})`
      );
      this.logger.trace(
        `Config PDA derivation: seeds=["${
          ROUTER_SEEDS.CONFIG
        }"], program=${this.routerProgramId.toString()}`
      );

      // Build accounts using the bindings structures
      const accounts: OwnerProposeAdministratorAccounts = {
        config: configPDA,
        tokenAdminRegistry: tokenAdminRegistryPDA,
        mint: options.tokenMint,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };
      this.logger.debug("Propose administrator accounts:", {
        config: accounts.config.toString(),
        tokenAdminRegistry: accounts.tokenAdminRegistry.toString(),
        mint: accounts.mint.toString(),
        authority: accounts.authority.toString(),
        systemProgram: accounts.systemProgram.toString(),
      });

      // Build args
      const args: OwnerProposeAdministratorArgs = {
        tokenAdminRegistryAdmin: options.newAdmin,
      };
      this.logger.debug("Propose administrator args:", {
        tokenAdminRegistryAdmin: args.tokenAdminRegistryAdmin.toString(),
      });

      // Create instruction using the bindings
      this.logger.debug("Creating ownerProposeAdministrator instruction...");
      const instruction = ownerProposeAdministrator(
        args,
        accounts,
        this.routerProgramId
      );
      this.logger.debug("Instruction created:", {
        programId: instruction.programId.toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((k, i) => ({
          index: i,
          pubkey: k.pubkey.toString(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

      // Execute transaction
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "proposeAdministrator",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(
        `Administrator proposed successfully. Tx signature: ${signature}`
      );
      return signature;
    } catch (error) {
      const enhanceError = createErrorEnhancer(this.logger);
      throw enhanceError(error, errorContext);
    }
  }

  /**
   * Accept the admin role for a token's registry.
   *
   * This is the second step in a two-step process for setting or changing
   * the administrator for a token. Only the proposed administrator
   * (set via `proposeAdministrator`) can call this method.
   *
   * @param options Configuration options including token mint
   * @returns Promise resolving to the transaction signature
   * @throws Error if the caller is not the proposed admin or if the transaction fails
   */
  async acceptAdminRole(options: AcceptAdminRoleOptions): Promise<string> {
    const errorContext = {
      operation: "acceptAdminRole",
      mint: options.tokenMint.toString(),
    };

    try {
      this.logger.info(
        `Accepting admin role for token: ${options.tokenMint.toString()}`
      );

      // Get signer and derive PDAs using bindings
      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug("Accept admin role details:", {
        mint: options.tokenMint.toString(),
        signer: signerPublicKey.toString(),
        programId: this.routerProgramId.toString(),
      });

      const [tokenAdminRegistryPDA, tokenAdminRegistryBump] =
        findTokenAdminRegistryPDA(options.tokenMint, this.routerProgramId);
      this.logger.debug(
        `Token Admin Registry PDA: ${tokenAdminRegistryPDA.toString()} (bump: ${tokenAdminRegistryBump})`
      );
      this.logger.trace(
        `Token Admin Registry PDA derivation: seeds=["${
          ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY
        }", ${options.tokenMint.toString()}], program=${this.routerProgramId.toString()}`
      );

      const [configPDA, configBump] = findConfigPDA(this.routerProgramId);
      this.logger.debug(
        `Config PDA: ${configPDA.toString()} (bump: ${configBump})`
      );
      this.logger.trace(
        `Config PDA derivation: seeds=["${
          ROUTER_SEEDS.CONFIG
        }"], program=${this.routerProgramId.toString()}`
      );

      // Build accounts using binding structures
      const accounts: AcceptAdminRoleTokenAdminRegistryAccounts = {
        config: configPDA,
        tokenAdminRegistry: tokenAdminRegistryPDA,
        mint: options.tokenMint,
        authority: signerPublicKey,
      };
      this.logger.debug("Accept admin role accounts:", {
        config: accounts.config.toString(),
        tokenAdminRegistry: accounts.tokenAdminRegistry.toString(),
        mint: accounts.mint.toString(),
        authority: accounts.authority.toString(),
      });

      // Create instruction using bindings (no args for this one)
      this.logger.debug(
        "Creating acceptAdminRoleTokenAdminRegistry instruction..."
      );
      const instruction = acceptAdminRoleTokenAdminRegistry(
        accounts,
        this.routerProgramId
      );
      this.logger.debug("Instruction created:", {
        programId: instruction.programId.toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((k, i) => ({
          index: i,
          pubkey: k.pubkey.toString(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

      // Execute transaction
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "acceptAdminRole",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(
        `Admin role accepted successfully. Tx signature: ${signature}`
      );
      return signature;
    } catch (error) {
      const enhanceError = createErrorEnhancer(this.logger);
      throw enhanceError(error, errorContext);
    }
  }

  /**
   * Transfer the admin role for a token to a new admin.
   *
   * This is the first step in a two-step ownership transfer process.
   * Only the current administrator can transfer the admin role.
   * The proposed new administrator must call `acceptAdminRole` to complete the transfer.
   *
   * @param options Configuration options including token mint and new admin
   * @returns Promise resolving to the transaction signature
   * @throws Error if the caller is not the current admin or if the transaction fails
   */
  async transferAdminRole(options: TransferAdminRoleOptions): Promise<string> {
    const errorContext = {
      operation: "transferAdminRole",
      mint: options.tokenMint.toString(),
      newAdmin: options.newAdmin.toString(),
    };

    try {
      this.logger.info(
        `Transferring admin role for token ${options.tokenMint.toString()} to ${options.newAdmin.toString()}`
      );

      // Get signer and derive PDAs
      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug("Transfer admin role details:", {
        mint: options.tokenMint.toString(),
        newAdmin: options.newAdmin.toString(),
        signer: signerPublicKey.toString(),
        programId: this.routerProgramId.toString(),
      });

      const [tokenAdminRegistryPDA, tokenAdminRegistryBump] =
        findTokenAdminRegistryPDA(options.tokenMint, this.routerProgramId);
      this.logger.debug(
        `Token Admin Registry PDA: ${tokenAdminRegistryPDA.toString()} (bump: ${tokenAdminRegistryBump})`
      );
      this.logger.trace(
        `Token Admin Registry PDA derivation: seeds=["${
          ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY
        }", ${options.tokenMint.toString()}], program=${this.routerProgramId.toString()}`
      );

      const [configPDA, configBump] = findConfigPDA(this.routerProgramId);
      this.logger.debug(
        `Config PDA: ${configPDA.toString()} (bump: ${configBump})`
      );
      this.logger.trace(
        `Config PDA derivation: seeds=["${
          ROUTER_SEEDS.CONFIG
        }"], program=${this.routerProgramId.toString()}`
      );

      // Build accounts
      const accounts: TransferAdminRoleTokenAdminRegistryAccounts = {
        config: configPDA,
        tokenAdminRegistry: tokenAdminRegistryPDA,
        mint: options.tokenMint,
        authority: signerPublicKey,
      };
      this.logger.debug("Transfer admin role accounts:", {
        config: accounts.config.toString(),
        tokenAdminRegistry: accounts.tokenAdminRegistry.toString(),
        mint: accounts.mint.toString(),
        authority: accounts.authority.toString(),
      });

      // Build args
      const args: TransferAdminRoleTokenAdminRegistryArgs = {
        newAdmin: options.newAdmin,
      };
      this.logger.debug("Transfer admin role args:", {
        newAdmin: args.newAdmin.toString(),
      });

      // Create instruction
      this.logger.debug(
        "Creating transferAdminRoleTokenAdminRegistry instruction..."
      );
      const instruction = transferAdminRoleTokenAdminRegistry(
        args,
        accounts,
        this.routerProgramId
      );
      this.logger.debug("Instruction created:", {
        programId: instruction.programId.toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((k, i) => ({
          index: i,
          pubkey: k.pubkey.toString(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

      // Execute transaction
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "transferAdminRole",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(
        `Admin role transfer initiated successfully. Tx signature: ${signature}`
      );
      return signature;
    } catch (error) {
      const enhanceError = createErrorEnhancer(this.logger);
      throw enhanceError(error, errorContext);
    }
  }

  /**
   * Sets the pool lookup table for a token.
   *
   * This configures which token pool should be used for a specific token.
   * Only the token administrator can set the pool.
   * Setting the lookup table to the zero address effectively delists the token from CCIP.
   *
   * @param options Configuration options including token mint and lookup table
   * @returns Promise resolving to the transaction signature
   * @throws Error if the caller is not the administrator or if the transaction fails
   */
  async setPool(options: SetPoolOptions): Promise<string> {
    const errorContext = {
      operation: "setPool",
      mint: options.tokenMint.toString(),
      lookupTable: options.lookupTable.toString(),
    };

    try {
      this.logger.info(
        `Setting pool for token ${options.tokenMint.toString()} with lookup table ${options.lookupTable.toString()}`
      );

      // Get signer and derive PDAs
      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug("Set pool details:", {
        mint: options.tokenMint.toString(),
        lookupTable: options.lookupTable.toString(),
        writableIndices: options.writableIndices,
        signer: signerPublicKey.toString(),
        programId: this.routerProgramId.toString(),
      });

      const [tokenAdminRegistryPDA, tokenAdminRegistryBump] =
        findTokenAdminRegistryPDA(options.tokenMint, this.routerProgramId);
      this.logger.debug(
        `Token Admin Registry PDA: ${tokenAdminRegistryPDA.toString()} (bump: ${tokenAdminRegistryBump})`
      );
      this.logger.trace(
        `Token Admin Registry PDA derivation: seeds=["${
          ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY
        }", ${options.tokenMint.toString()}], program=${this.routerProgramId.toString()}`
      );

      const [configPDA, configBump] = findConfigPDA(this.routerProgramId);
      this.logger.debug(
        `Config PDA: ${configPDA.toString()} (bump: ${configBump})`
      );
      this.logger.trace(
        `Config PDA derivation: seeds=["${
          ROUTER_SEEDS.CONFIG
        }"], program=${this.routerProgramId.toString()}`
      );

      // Build accounts
      const accounts: SetPoolAccounts = {
        config: configPDA,
        tokenAdminRegistry: tokenAdminRegistryPDA,
        mint: options.tokenMint,
        poolLookuptable: options.lookupTable,
        authority: signerPublicKey,
      };
      this.logger.debug("Set pool accounts:", {
        config: accounts.config.toString(),
        tokenAdminRegistry: accounts.tokenAdminRegistry.toString(),
        mint: accounts.mint.toString(),
        poolLookuptable: accounts.poolLookuptable.toString(),
        authority: accounts.authority.toString(),
      });

      const args = {
        writableIndexes: Uint8Array.from(options.writableIndices),
      };
      this.logger.debug("Set pool args:", {
        writableIndexes: options.writableIndices,
      });

      // Create instruction
      this.logger.debug("Creating setPool instruction...");
      const instruction = setPool(args, accounts, this.routerProgramId);
      this.logger.debug("Instruction created:", {
        programId: instruction.programId.toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((k, i) => ({
          index: i,
          pubkey: k.pubkey.toString(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

      // Execute transaction
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "setPool",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Pool set successfully. Tx signature: ${signature}`);
      return signature;
    } catch (error) {
      const enhanceError = createErrorEnhancer(this.logger);
      throw enhanceError(error, errorContext);
    }
  }

  /**
   * Creates an Address Lookup Table (ALT) for a token pool with all necessary addresses.
   *
   * This method creates and extends an ALT with all the addresses required for CCIP token operations.
   * The ALT is essential for efficient cross-chain transactions as it reduces transaction size
   * by allowing address references instead of full public keys.
   *
   * The ALT includes:
   * - The lookup table itself
   * - Token admin registry PDA
   * - Pool program ID
   * - Pool configuration PDA
   * - Pool token account (ATA)
   * - Pool signer PDA
   * - Token program ID
   * - Token mint
   * - Fee billing token config PDA
   * - CCIP router pool signer PDA
   *
   * @param options Configuration options including token mint and program IDs
   * @returns Promise resolving to the creation result with signature and ALT details
   * @throws Error if the caller doesn't have sufficient SOL or if the transaction fails
   */
  async createTokenPoolLookupTable(
    options: CreateTokenPoolLookupTableOptions
  ): Promise<CreateTokenPoolLookupTableResult> {
    const errorContext = {
      operation: "createTokenPoolLookupTable",
      mint: options.tokenMint.toString(),
      poolProgram: options.poolProgramId.toString(),
    };

    try {
      this.logger.info(
        `Creating token pool lookup table for mint: ${options.tokenMint.toString()}`
      );

      // Get signer and auto-detect token program
      const signerPublicKey = this.context.provider.getAddress();

      this.logger.debug("Auto-detecting token program for mint...");
      const tokenProgramId = await detectTokenProgram(
        options.tokenMint,
        this.context.provider.connection,
        this.logger
      );

      this.logger.debug("Create ALT details:", {
        mint: options.tokenMint.toString(),
        poolProgram: options.poolProgramId.toString(),
        tokenProgram: tokenProgramId.toString(),
        feeQuoterProgram: options.feeQuoterProgramId.toString(),
        signer: signerPublicKey.toString(),
        routerProgram: this.routerProgramId.toString(),
      });

      // Get the current slot for ALT creation
      const slot = await this.context.provider.connection.getSlot("finalized");
      this.logger.debug(`Using finalized slot for ALT creation: ${slot}`);

      // Step 1: Create the lookup table
      this.logger.debug("Creating Address Lookup Table...");
      const [createInstruction, lookupTableAddress] =
        AddressLookupTableProgram.createLookupTable({
          authority: signerPublicKey,
          payer: signerPublicKey,
          recentSlot: slot,
        });

      this.logger.debug(
        `ALT will be created at address: ${lookupTableAddress.toString()}`
      );
      this.logger.trace("Create ALT instruction:", {
        programId: createInstruction.programId.toString(),
        dataLength: createInstruction.data.length,
        keyCount: createInstruction.keys.length,
      });

      // Derive all necessary PDAs and addresses
      this.logger.debug("Deriving PDAs and addresses for ALT...");

      // Token Admin Registry PDA
      const [tokenAdminRegistryPDA, tokenAdminRegistryBump] =
        findTokenAdminRegistryPDA(options.tokenMint, this.routerProgramId);
      this.logger.debug(
        `Token Admin Registry PDA: ${tokenAdminRegistryPDA.toString()} (bump: ${tokenAdminRegistryBump})`
      );
      this.logger.trace(
        `Token Admin Registry PDA derivation: seeds=["${
          ROUTER_SEEDS.TOKEN_ADMIN_REGISTRY
        }", ${options.tokenMint.toString()}], program=${this.routerProgramId.toString()}`
      );

      // Pool Configuration PDA (using burn-mint pool structure)
      const [poolConfigPDA, poolConfigBump] = findBurnMintPoolConfigPDA(
        options.tokenMint,
        options.poolProgramId
      );
      this.logger.debug(
        `Pool Config PDA: ${poolConfigPDA.toString()} (bump: ${poolConfigBump})`
      );
      this.logger.trace(
        `Pool Config PDA derivation: seeds=["${TOKEN_POOL_STATE_SEED}", ${options.tokenMint.toString()}], program=${options.poolProgramId.toString()}`
      );

      // Pool Signer PDA
      const [poolSignerPDA, poolSignerBump] = findPoolSignerPDA(
        options.tokenMint,
        options.poolProgramId
      );
      this.logger.debug(
        `Pool Signer PDA: ${poolSignerPDA.toString()} (bump: ${poolSignerBump})`
      );
      this.logger.trace(
        `Pool Signer PDA derivation: seeds=["${TOKEN_POOL_POOL_SIGNER_SEED}", ${options.tokenMint.toString()}], program=${options.poolProgramId.toString()}`
      );

      // Pool Token Account (ATA for pool signer)
      const poolTokenAccount = getAssociatedTokenAddressSync(
        options.tokenMint,
        poolSignerPDA,
        true, // allowOwnerOffCurve
        tokenProgramId
      );
      this.logger.debug(
        `Pool Token Account (ATA): ${poolTokenAccount.toString()}`
      );
      this.logger.trace(
        `Pool Token Account derivation: mint=${options.tokenMint.toString()}, owner=${poolSignerPDA.toString()}, tokenProgram=${tokenProgramId.toString()}`
      );

      // Fee Billing Token Config PDA
      const [feeTokenConfigPDA, feeTokenConfigBump] =
        findFqBillingTokenConfigPDA(
          options.tokenMint,
          options.feeQuoterProgramId
        );
      this.logger.debug(
        `Fee Token Config PDA: ${feeTokenConfigPDA.toString()} (bump: ${feeTokenConfigBump})`
      );
      this.logger.trace(
        `Fee Token Config PDA derivation: mint=${options.tokenMint.toString()}, program=${options.feeQuoterProgramId.toString()}`
      );

      // CCIP Router Pool Signer PDA (follows dummy script pattern)
      const [ccipRouterPoolSignerPDA, ccipRouterPoolSignerBump] =
        PublicKey.findProgramAddressSync(
          [
            Buffer.from(ROUTER_SEEDS.EXTERNAL_TOKEN_POOLS_SIGNER),
            options.poolProgramId.toBuffer(),
          ],
          this.routerProgramId
        );
      this.logger.debug(
        `CCIP Router Pool Signer PDA: ${ccipRouterPoolSignerPDA.toString()} (bump: ${ccipRouterPoolSignerBump})`
      );
      this.logger.trace(
        `CCIP Router Pool Signer PDA derivation: seeds=["${
          ROUTER_SEEDS.EXTERNAL_TOKEN_POOLS_SIGNER
        }", ${options.poolProgramId.toString()}], program=${this.routerProgramId.toString()}`
      );

      // Build the addresses array for the lookup table
      const addresses = [
        lookupTableAddress, // Index 0: The lookup table itself
        tokenAdminRegistryPDA, // Index 1: Token admin registry
        options.poolProgramId, // Index 2: Pool program
        poolConfigPDA, // Index 3: Pool configuration
        poolTokenAccount, // Index 4: Pool token account
        poolSignerPDA, // Index 5: Pool signer
        tokenProgramId, // Index 6: Token program
        options.tokenMint, // Index 7: Token mint
        feeTokenConfigPDA, // Index 8: Fee token config
        ccipRouterPoolSignerPDA, // Index 9: CCIP router pool signer
      ];

      this.logger.debug(`ALT will contain ${addresses.length} addresses:`);
      addresses.forEach((addr, index) => {
        this.logger.trace(`  [${index}]: ${addr.toString()}`);
      });

      // Step 2: Extend the lookup table with addresses
      this.logger.debug("Creating extend ALT instruction...");
      const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        lookupTable: lookupTableAddress,
        authority: signerPublicKey,
        payer: signerPublicKey,
        addresses: addresses,
      });

      this.logger.trace("Extend ALT instruction:", {
        programId: extendInstruction.programId.toString(),
        dataLength: extendInstruction.data.length,
        keyCount: extendInstruction.keys.length,
        addressCount: addresses.length,
      });

      // Execute both instructions in a single transaction
      this.logger.debug("Executing ALT creation and extension transaction...");
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "createTokenPoolLookupTable",
      };

      const signature = await executeTransaction(
        this.context,
        [createInstruction, extendInstruction],
        executionOptions
      );

      const result: CreateTokenPoolLookupTableResult = {
        signature,
        lookupTableAddress,
        addresses,
      };

      this.logger.info(
        `Token pool lookup table created successfully. ALT address: ${lookupTableAddress.toString()}`
      );
      this.logger.info(`Transaction signature: ${signature}`);
      this.logger.debug("ALT creation result:", {
        lookupTableAddress: result.lookupTableAddress.toString(),
        addressCount: result.addresses.length,
      });

      return result;
    } catch (error) {
      const enhanceError = createErrorEnhancer(this.logger);
      throw enhanceError(error, errorContext);
    }
  }
}
