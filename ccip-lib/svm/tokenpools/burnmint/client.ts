import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { CCIPContext } from "../../core/models";
import {
  BurnMintChainConfigOptions,
  BurnMintPoolInitializeOptions,
  BurnMintSetRateLimitOptions,
  TokenPoolAccountReader,
  TokenPoolClient,
  TransferAdminRoleOptions,
  AcceptAdminRoleOptions,
  SetRouterOptions,
  AppendRemotePoolAddressesOptions,
  DeleteChainConfigOptions,
  ConfigureAllowlistOptions,
  RemoveFromAllowlistOptions,
  InitializeStateVersionOptions,
} from "../abstract";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import {
  executeTransaction,
  extractTxOptions,
  TransactionExecutionOptions,
} from "../../utils/transaction";
import {
  BurnMintTokenPoolAccountReader,
  BurnMintTokenPoolInfo,
} from "./accounts";
import {
  findBurnMintPoolConfigPDA,
  findBurnMintPoolChainConfigPDA,
  findProgramDataPDA,
} from "../../utils/pdas/tokenpool";
import {
  initialize,
  InitializeAccounts,
  InitializeArgs,
  initChainRemoteConfig,
  InitChainRemoteConfigAccounts,
  InitChainRemoteConfigArgs,
  setChainRateLimit,
  SetChainRateLimitAccounts,
  SetChainRateLimitArgs,
  transferOwnership,
  TransferOwnershipAccounts,
  TransferOwnershipArgs,
  acceptOwnership,
  AcceptOwnershipAccounts,
  setRouter,
  SetRouterArgs,
  SetRouterAccounts,
  initializeStateVersion,
  InitializeStateVersionAccounts,
  InitializeStateVersionArgs,
  configureAllowList,
  ConfigureAllowListArgs,
  ConfigureAllowListAccounts,
  removeFromAllowList,
  RemoveFromAllowListArgs,
  RemoveFromAllowListAccounts,
  appendRemotePoolAddresses,
  AppendRemotePoolAddressesArgs,
  AppendRemotePoolAddressesAccounts,
  deleteChainConfig,
  DeleteChainConfigAccounts,
  editChainRemoteConfig,
  EditChainRemoteConfigArgs,
  EditChainRemoteConfigAccounts,
} from "../../burnmint-pool-bindings/instructions";
import {
  RemoteConfig,
  RemoteAddress,
  RateLimitConfig,
} from "../../burnmint-pool-bindings/types";
import { BN } from "@coral-xyz/anchor";

/**
 * Implementation of TokenPoolClient for burn-mint token pools
 */
export class BurnMintTokenPoolClient implements TokenPoolClient {
  private readonly accountReader: BurnMintTokenPoolAccountReader;
  private readonly logger: Logger;
  private readonly programId: PublicKey;

  /**
   * Creates a new BurnMintTokenPoolClient
   * @param context CCIP context
   * @param programId Burn-mint token pool program ID
   */
  constructor(readonly context: CCIPContext, programId: PublicKey) {
    this.logger =
      context.logger ??
      createLogger("burnmint-pool-client", { level: LogLevel.INFO });
    this.programId = programId;
    this.accountReader = new BurnMintTokenPoolAccountReader(
      context,
      this.programId
    );

    this.logger.debug(
      `BurnMintTokenPoolClient initialized: programId=${this.getProgramId().toString()}`
    );
  }

  /** @inheritDoc */
  getProgramId(): PublicKey {
    return this.programId;
  }

  /** @inheritDoc */
  getAccountReader(): TokenPoolAccountReader {
    return this.accountReader;
  }

  /** @inheritDoc */
  async getPoolInfo(mint: PublicKey): Promise<BurnMintTokenPoolInfo> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(`Getting pool info for mint: ${mint.toString()}`);

      // Get the pool config
      const poolConfig = await this.accountReader.getPoolConfig(mint);

      // Convert to BurnMintTokenPoolInfo
      return {
        programId: this.getProgramId(),
        config: poolConfig,
        poolType: "burn-mint",
      };
    } catch (error) {
      throw enhanceError(error, {
        operation: "getPoolInfo",
        mint: mint.toString(),
      });
    }
  }

  /** @inheritDoc */
  async initializePool(
    mint: PublicKey,
    options: BurnMintPoolInitializeOptions
  ): Promise<string> {
    const errorContext = {
      operation: "initializePool",
      mint: mint.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Initializing burn-mint pool for mint: ${mint.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();

      // Find the pool config PDA (state)
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Find program data PDA
      const [programDataPDA] = findProgramDataPDA(this.getProgramId());

      // Build the accounts for the initialize instruction
      const accounts: InitializeAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
        program: this.getProgramId(),
        programData: programDataPDA,
      };

      // Build the args - use router and rmn_remote from context
      const args: InitializeArgs = {
        router: this.context.config.ccipRouterProgramId,
        rmnRemote: this.context.config.rmnRemoteProgramId,
      };

      // Create the instruction using the imported builder
      const instruction = initialize(args, accounts, this.getProgramId());

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "initializePool",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Burn-mint pool initialized: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async configureChain(
    mint: PublicKey,
    remoteChainSelector: bigint,
    options: BurnMintChainConfigOptions
  ): Promise<string> {
    // Define context for error enhancement early
    const errorContext = {
      operation: "configureChain",
      mint: mint.toString(),
      destChainSelector: remoteChainSelector.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Configuring chain ${remoteChainSelector.toString()} for mint: ${mint.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();

      // Verify pool exists (getPoolConfig will throw if not found)
      const poolConfig = await this.accountReader.getPoolConfig(mint);

      // Check if signer is owner
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        // Throw a specific error, will be caught and enhanced below
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the chain config PDA
      const [chainConfigPDA] = findBurnMintPoolChainConfigPDA(
        remoteChainSelector,
        mint,
        this.getProgramId()
      );

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Validate and transform pool addresses from options
      if (!options.poolAddresses || options.poolAddresses.length === 0) {
        // Throw specific error
        throw new Error("At least one pool address must be provided");
      }

      // Create RemoteAddresses from the provided addresses
      const remotePoolAddresses = options.poolAddresses.map((addr) => {
        // Convert hex string to Uint8Array
        const buffer = Buffer.from(addr, "hex");
        // Ensure address is exactly 32 bytes
        if (buffer.length !== 32) {
          // Throw specific error
          throw new Error(
            `Pool address must be 32 bytes, got ${buffer.length} bytes for ${addr}`
          );
        }
        return new RemoteAddress({ address: buffer });
      });

      // Validate and transform token address
      if (!options.tokenAddress) {
        // Throw specific error
        throw new Error("Token address must be provided");
      }
      const tokenAddressBuffer = Buffer.from(options.tokenAddress, "hex");
      if (tokenAddressBuffer.length !== 32) {
        // Throw specific error
        throw new Error(
          `Token address must be 32 bytes, got ${tokenAddressBuffer.length} bytes`
        );
      }
      const remoteTokenAddress = new RemoteAddress({
        address: tokenAddressBuffer,
      });

      // Validate decimals
      if (
        options.decimals === undefined ||
        options.decimals < 0 ||
        options.decimals > 18
      ) {
        // Throw specific error
        throw new Error("Invalid decimals value. Must be between 0 and 18.");
      }

      // Create RemoteConfig from options
      const remoteConfig: RemoteConfig = new RemoteConfig({
        poolAddresses: remotePoolAddresses,
        tokenAddress: remoteTokenAddress,
        decimals: options.decimals,
      });

      // Check if chain config already exists
      let chainConfigExists = false;
      try {
        await this.accountReader.getChainConfig(mint, remoteChainSelector);
        chainConfigExists = true;
        this.logger.debug(`Chain config already exists, will update it`);
      } catch (error) {
        this.logger.debug(`Chain config does not exist, will initialize it`);
      }

      // Create the instruction
      let instruction: TransactionInstruction;

      if (chainConfigExists) {
        // Use editChainRemoteConfig since it already exists
        const accounts: EditChainRemoteConfigAccounts = {
          state: statePDA,
          chainConfig: chainConfigPDA,
          authority: signerPublicKey,
          systemProgram: SystemProgram.programId,
        };

        const args: EditChainRemoteConfigArgs = {
        remoteChainSelector: new BN(remoteChainSelector.toString()),
        mint: mint,
        cfg: remoteConfig,
      };

        instruction = editChainRemoteConfig(
        args,
        accounts,
        this.getProgramId()
      );
        this.logger.debug(`Created edit chain remote config instruction`);
      } else {
        // Use initChainRemoteConfig since it's new
        const accounts: InitChainRemoteConfigAccounts = {
          state: statePDA,
          chainConfig: chainConfigPDA,
          authority: signerPublicKey,
          systemProgram: SystemProgram.programId,
        };

        const args: InitChainRemoteConfigArgs = {
          remoteChainSelector: new BN(remoteChainSelector.toString()),
          mint: mint,
          cfg: remoteConfig,
        };

        instruction = initChainRemoteConfig(
          args,
          accounts,
          this.getProgramId()
        );
        this.logger.debug(`Created init chain remote config instruction`);
      }

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "configureChain",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(
        `Chain ${chainConfigExists ? "updated" : "initialized"}: ${signature}`
      );
      return signature;
    } catch (error) {
      // Enhance *any* error caught (validation or async) with context
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async setRateLimit(
    mint: PublicKey,
    remoteChainSelector: bigint,
    options: BurnMintSetRateLimitOptions
  ): Promise<string> {
    // 1. Define error context early
    const errorContext = {
      operation: "setRateLimit",
      mint: mint.toString(),
      remoteChainSelector: remoteChainSelector.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      // 2. Standard setup: logger, signer, connection
      this.logger.info(
        `Setting rate limits for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
      );
      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // 3. Validation:
      //    a. Verify pool state exists
      const poolConfig = await this.accountReader.getPoolConfig(mint); // Throws if not found

      //    b. Verify authority (Owner or Rate Limit Admin)
      const isOwner = poolConfig.config.owner.equals(signerPublicKey);
      // Check if rateLimitAdmin exists on the config object before comparing
      const isRateAdmin =
        poolConfig.config.rateLimitAdmin &&
        poolConfig.config.rateLimitAdmin.equals(signerPublicKey);

      if (!isOwner && !isRateAdmin) {
        throw new Error(
          `Signer is not the owner or rate limit admin of the pool`
        );
      }

      //    c. Verify target chain config exists (No fallback/hardcoding)
      await this.accountReader.getChainConfig(mint, remoteChainSelector); // Throws if not found

      // 4. Prepare Accounts: Use correct types
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());
      const [chainConfigPDA] = findBurnMintPoolChainConfigPDA(
        remoteChainSelector,
        mint,
        this.getProgramId()
      );
      const accounts: SetChainRateLimitAccounts = {
        // Use correct type
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
      };

      // 5. Prepare Arguments: Use correct types and convert bigints
      const inboundCfg = new RateLimitConfig({
        enabled: options.inbound.enabled,
        capacity: new BN(options.inbound.capacity.toString()),
        rate: new BN(options.inbound.rate.toString()),
      });
      const outboundCfg = new RateLimitConfig({
        enabled: options.outbound.enabled,
        capacity: new BN(options.outbound.capacity.toString()),
        rate: new BN(options.outbound.rate.toString()),
      });

      const args: SetChainRateLimitArgs = {
        // Use correct type
        remoteChainSelector: new BN(remoteChainSelector.toString()),
        mint: mint,
        inbound: inboundCfg, // Pass inbound config
        outbound: outboundCfg, // Pass outbound config
      };

      // 6. Create Instruction: Use correct builder
      const instruction = setChainRateLimit(
        // Use correct builder
        args,
        accounts,
        this.getProgramId()
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "setRateLimit",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      // 8. Logging
      this.logger.info(
        `Rate limits set for chain ${remoteChainSelector.toString()}: ${signature}`
      );
      return signature;
    } catch (error) {
      // 9. Consistent Error Handling: Enhance all caught errors
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async hasPool(mint: PublicKey): Promise<boolean> {
    try {
      await this.accountReader.getPoolConfig(mint);
      return true;
    } catch (error) {
      this.logger.warn(`Pool not found for mint: ${mint.toString()}`);
      return false;
    }
  }

  /** @inheritDoc */
  async hasChainConfig(
    mint: PublicKey,
    remoteChainSelector: bigint
  ): Promise<boolean> {
    try {
      await this.accountReader.getChainConfig(mint, remoteChainSelector);
      return true;
    } catch (error) {
      this.logger.warn(
        `Chain config not found for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
      );
      return false;
    }
  }

  /** @inheritDoc */
  async transferAdminRole(
    mint: PublicKey,
    options: TransferAdminRoleOptions
  ): Promise<string> {
    const errorContext = {
      operation: "transferAdminRole",
      mint: mint.toString(),
      newAdmin: options.newAdmin.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Proposing ownership transfer for mint: ${mint.toString()} to: ${options.newAdmin.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // Verify pool exists
      const poolConfig = await this.accountReader.getPoolConfig(mint);

      // Check if signer is owner
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Build the accounts
      const accounts: TransferOwnershipAccounts = {
        state: statePDA,
        mint: mint,
        authority: signerPublicKey,
      };

      // Build the args
      const args: TransferOwnershipArgs = {
        proposedOwner: options.newAdmin,
      };

      // Create the instruction
      const instruction = transferOwnership(
        args,
        accounts,
        this.getProgramId()
      );

      // Execute the transaction using the shared utility
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

      this.logger.info(`Admin role transfer proposed: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async acceptAdminRole(
    mint: PublicKey,
    options?: AcceptAdminRoleOptions
  ): Promise<string> {
    const errorContext = {
      operation: "acceptAdminRole",
      mint: mint.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(`Accepting admin role for mint: ${mint.toString()}...`);

      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // Verify pool exists and fetch config
      const poolConfig = await this.accountReader.getPoolConfig(mint);

      // Check if signer is the proposed owner
      // Ensure proposedOwner is not null/default before comparing
      if (
        !poolConfig.config.proposedOwner ||
        poolConfig.config.proposedOwner.equals(PublicKey.default) || // Check against default PublicKey
        !poolConfig.config.proposedOwner.equals(signerPublicKey)
      ) {
        throw new Error(
          `Signer ${signerPublicKey.toString()} is not the proposed owner (${poolConfig.config.proposedOwner?.toString()}) for this pool`
        );
      }

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Build the accounts
      const accounts: AcceptOwnershipAccounts = {
        state: statePDA,
        mint: mint,
        authority: signerPublicKey, // The caller (proposed owner) is the authority here
      };

      // Create the instruction (acceptOwnership has no args)
      const instruction = acceptOwnership(accounts, this.getProgramId());

      // Execute the transaction using the shared utility
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

      this.logger.info(`Admin role accepted: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async setRouter(mint: PublicKey, options: SetRouterOptions): Promise<string> {
    const errorContext = {
      operation: "setRouter",
      mint: mint.toString(),
      newRouter: options.newRouter.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Setting router for mint: ${mint.toString()} to: ${options.newRouter.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Build the accounts
      const accounts: SetRouterAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
      };

      // Build the args
      const args: SetRouterArgs = {
        newRouter: options.newRouter,
      };

      // Create the instruction
      const instruction = setRouter(args, accounts, this.getProgramId());

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "setRouter",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Router updated: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async initializeStateVersion(
    mint: PublicKey,
    options?: InitializeStateVersionOptions
  ): Promise<string> {
    const errorContext = {
      operation: "initializeStateVersion",
      mint: mint.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Initializing state version for mint: ${mint.toString()}`
      );

      const connection = this.context.provider.connection;

      // Note: This operation is permissionless - no owner check needed

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Build the accounts
      const accounts: InitializeStateVersionAccounts = {
        state: statePDA,
      };

      // Create the args
      const args: InitializeStateVersionArgs = {
        mint,
      };

      // Create the instruction
      const instruction = initializeStateVersion(
        args,
        accounts,
        this.getProgramId()
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "initializeStateVersion",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`State version initialized: ${signature}`);
      return signature;
        } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async configureAllowlist(
    mint: PublicKey,
    options: ConfigureAllowlistOptions
  ): Promise<string> {
    const errorContext = {
      operation: "configureAllowlist",
      mint: mint.toString(),
      enabled: String(options.enabled),
      addCount: String(options.add.length),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Configuring allowlist for mint: ${mint.toString()}, enabled: ${
          options.enabled
        }, adding ${options.add.length} addresses`
      );

      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Build the accounts
      const accounts: ConfigureAllowListAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Build the args
      const args: ConfigureAllowListArgs = {
        add: options.add,
        enabled: options.enabled,
      };

      // Create the instruction
      const instruction = configureAllowList(
        args,
        accounts,
        this.getProgramId()
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "configureAllowlist",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Allowlist configured: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async removeFromAllowlist(
    mint: PublicKey,
    options: RemoveFromAllowlistOptions
  ): Promise<string> {
    const errorContext = {
      operation: "removeFromAllowlist",
      mint: mint.toString(),
      removeCount: String(options.remove.length),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Removing ${
          options.remove.length
        } addresses from allowlist for mint: ${mint.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Build the accounts
      const accounts: RemoveFromAllowListAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Build the args
      const args: RemoveFromAllowListArgs = {
        remove: options.remove,
      };

      // Create the instruction
      const instruction = removeFromAllowList(
        args,
        accounts,
        this.getProgramId()
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "removeFromAllowlist",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Removed from allowlist: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async appendRemotePoolAddresses(
    mint: PublicKey,
    options: AppendRemotePoolAddressesOptions
  ): Promise<string> {
    const errorContext = {
      operation: "appendRemotePoolAddresses",
      mint: mint.toString(),
      remoteChainSelector: options.remoteChainSelector.toString(),
      addressCount: String(options.addresses.length),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Appending ${
          options.addresses.length
        } remote pool addresses for mint: ${mint.toString()}, chain: ${options.remoteChainSelector.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Verify chain configuration exists
      await this.accountReader.getChainConfig(
        mint,
        options.remoteChainSelector
      );

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Find the chain config PDA
      const [chainConfigPDA] = findBurnMintPoolChainConfigPDA(
        options.remoteChainSelector,
        mint,
        this.getProgramId()
      );

      // Convert hex string addresses to RemoteAddress objects
      const remoteAddresses = options.addresses.map((addr) => {
        const buffer = Buffer.from(addr, "hex");
        if (buffer.length !== 32) {
          throw new Error(
            `Pool address must be 32 bytes, got ${buffer.length} bytes for ${addr}`
          );
        }
        return new RemoteAddress({ address: buffer });
      });

      // Build the accounts
      const accounts: AppendRemotePoolAddressesAccounts = {
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Build the args
      const args: AppendRemotePoolAddressesArgs = {
        remoteChainSelector: new BN(options.remoteChainSelector.toString()),
        addresses: remoteAddresses,
        mint,
      };

      // Create the instruction
      const instruction = appendRemotePoolAddresses(
        args,
        accounts,
        this.getProgramId()
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "appendRemotePoolAddresses",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Remote pool addresses appended: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async deleteChainConfig(
    mint: PublicKey,
    options: DeleteChainConfigOptions
  ): Promise<string> {
    const errorContext = {
      operation: "deleteChainConfig",
      mint: mint.toString(),
      remoteChainSelector: options.remoteChainSelector.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Deleting chain config for mint: ${mint.toString()}, chain: ${options.remoteChainSelector.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      const connection = this.context.provider.connection;

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Verify chain configuration exists
      await this.accountReader.getChainConfig(
        mint,
        options.remoteChainSelector
      );

      // Find the state PDA
      const [statePDA] = findBurnMintPoolConfigPDA(mint, this.getProgramId());

      // Find the chain config PDA
      const [chainConfigPDA] = findBurnMintPoolChainConfigPDA(
        options.remoteChainSelector,
        mint,
        this.getProgramId()
      );

      // Build the accounts
      const accounts: DeleteChainConfigAccounts = {
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
      };

      // Create the instruction with args
      const args = {
        remoteChainSelector: new BN(options.remoteChainSelector.toString()),
        mint,
      };
      const instruction = deleteChainConfig(
        args,
        accounts,
        this.getProgramId()
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "deleteChainConfig",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Chain config deleted: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }
}
