import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { CCIPContext } from "../../core/models";
import {
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
  InitChainRemoteConfigOptions,
  EditChainRemoteConfigOptions,
  RemoteChainConfigResult,
  UpdateSelfServedAllowedOptions,
  UpdateDefaultRouterOptions,
  UpdateDefaultRmnOptions,
  TransferMintAuthorityToMultisigOptions,
} from "../abstract";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";
import { padTo32Bytes } from "../../utils/conversion";
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
  findGlobalConfigPDA,
  findPoolSignerPDA,
  TOKEN_POOL_STATE_SEED,
  TOKEN_POOL_CHAIN_CONFIG_SEED,
  TOKEN_POOL_GLOBAL_CONFIG_SEED,
} from "../../utils/pdas/tokenpool";
import {
  initialize,
  InitializeAccounts,
  initGlobalConfig,
  InitGlobalConfigArgs,
  InitGlobalConfigAccounts,
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
  DeleteChainConfigArgs,
  updateSelfServedAllowed,
  UpdateSelfServedAllowedArgs,
  UpdateSelfServedAllowedAccounts,
  updateDefaultRouter,
  UpdateDefaultRouterArgs,
  UpdateDefaultRouterAccounts,
  updateDefaultRmn,
  UpdateDefaultRmnArgs,
  UpdateDefaultRmnAccounts,
  transferMintAuthorityToMultisig,
  TransferMintAuthorityToMultisigAccounts,
} from "../../burnmint-pool-bindings/instructions";
import {
  RemoteConfig,
  RemoteAddress,
  RateLimitConfig,
} from "../../burnmint-pool-bindings/types";
import { BN } from "@coral-xyz/anchor";
import {
  createBurnMintPoolEventParser,
  RemoteChainConfiguredEvent,
  BurnMintPoolEventParser,
} from "./events";

/**
 * Implementation of TokenPoolClient for burn-mint token pools
 */
export class BurnMintTokenPoolClient implements TokenPoolClient {
  private readonly accountReader: BurnMintTokenPoolAccountReader;
  private readonly logger: Logger;
  private readonly programId: PublicKey;
  private readonly eventParser: BurnMintPoolEventParser;

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

    // Create event parser (no IDL required for simplified parsing)
    this.eventParser = createBurnMintPoolEventParser(programId, context);
    this.logger.debug("Event parsing enabled using manual parsing");

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
  async getGlobalConfigInfo(): Promise<any> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug("Getting global config info");
      this.logger.debug(`Query details:`, {
        programId: this.getProgramId().toString(),
      });

      // Use the account reader to get the global config
      const globalConfig = await this.accountReader.getGlobalConfigInfo();
      this.logger.debug(`Global config retrieved successfully:`, {
        version: globalConfig.version,
        selfServedAllowed: globalConfig.self_served_allowed,
      });

      // Return in a format similar to getPoolInfo
      return {
        programId: this.getProgramId(),
        config: globalConfig,
        configType: "global",
      };
    } catch (error) {
      throw enhanceError(error, {
        operation: "getGlobalConfigInfo",
      });
    }
  }

  /** @inheritDoc */
  async getPoolInfo(mint: PublicKey): Promise<BurnMintTokenPoolInfo> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(`Fetching pool info for mint: ${mint.toString()}`);
      this.logger.debug(`Query details:`, {
        mint: mint.toString(),
        programId: this.getProgramId().toString(),
      });

      // Get the pool config
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Pool config retrieved successfully:`, {
        version: poolConfig.version,
        owner: poolConfig.config.owner.toString(),
        decimals: poolConfig.config.decimals,
        router: poolConfig.config.router.toString(),
      });

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

  /**
   * Initializes the global configuration for the burn-mint token pool program.
   * This must be called once per program deployment before any pools can be initialized.
   * Only callable by the program upgrade authority.
   */
  async initializeGlobalConfig(options?: { txOptions?: any }): Promise<string> {
    const errorContext = {
      operation: "initializeGlobalConfig",
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Initializing global config for burn-mint token pool program`
      );

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Signer: ${signerPublicKey.toString()}`);
      this.logger.debug(`Program ID: ${this.getProgramId().toString()}`);

      // Find the global config PDA
      const [globalConfigPDA, globalConfigBump] = findGlobalConfigPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Global config PDA: ${globalConfigPDA.toString()} (bump: ${globalConfigBump})`
      );
      this.logger.trace(
        `Global config PDA derivation: seeds=[${TOKEN_POOL_GLOBAL_CONFIG_SEED}], program=${this.getProgramId().toString()}`
      );

      // Find program data PDA
      const [programDataPDA, programDataBump] = findProgramDataPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Program data PDA: ${programDataPDA.toString()} (bump: ${programDataBump})`
      );
      this.logger.trace(
        `Program data PDA derivation: program=${this.getProgramId().toString()}`
      );

      const args: InitGlobalConfigArgs = {
        routerAddress: this.context.config.ccipRouterProgramId,
        rmnAddress: this.context.config.rmnRemoteProgramId,
      };

      this.logger.debug("Init global config args:", {
        routerAddress: this.context.config.ccipRouterProgramId.toString(),
        rmnAddress: this.context.config.rmnRemoteProgramId.toString(),
      });

      // Build the accounts for the init_global_config instruction
      const accounts: InitGlobalConfigAccounts = {
        config: globalConfigPDA,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
        program: this.getProgramId(),
        programData: programDataPDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Initialize global config accounts:", {
        config: globalConfigPDA.toString(),
        authority: signerPublicKey.toString(),
        system_program: SystemProgram.programId.toString(),
        program: this.getProgramId().toString(),
        program_data: programDataPDA.toString(),
      });

      // Create the instruction using the imported builder (no args needed)
      this.logger.debug("Creating init_global_config instruction...");
      const instruction = initGlobalConfig(args, accounts, this.getProgramId());

      // Log instruction details
      this.logger.debug("Initialize global config instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "initializeGlobalConfig",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Global config initialized: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
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
      this.logger.debug(`Pool initialization details:`);
      this.logger.debug(`  Mint: ${mint.toString()}`);
      this.logger.debug(`  Signer: ${signerPublicKey.toString()}`);
      this.logger.debug(`  Program ID: ${this.getProgramId().toString()}`);

      // Find the pool config PDA (state)
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.info(`📍 Pool State PDA: ${statePDA.toString()}`);
      this.logger.debug(`  State PDA bump: ${stateBump}`);
      this.logger.trace(
        `  State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Find program data PDA
      const [programDataPDA, programDataBump] = findProgramDataPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `  Program data PDA: ${programDataPDA.toString()} (bump: ${programDataBump})`
      );

      // Find the global config PDA
      const [globalConfigPDA, globalConfigBump] = findGlobalConfigPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `  Global config PDA: ${globalConfigPDA.toString()} (bump: ${globalConfigBump})`
      );

      // Build the accounts for the initialize instruction
      const accounts: InitializeAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
        program: this.getProgramId(),
        programData: programDataPDA,
        config: globalConfigPDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Initialize pool accounts:", {
        state: statePDA.toString(),
        mint: mint.toString(),
        authority: signerPublicKey.toString(),
        system_program: SystemProgram.programId.toString(),
        program: this.getProgramId().toString(),
        program_data: programDataPDA.toString(),
        config: globalConfigPDA.toString(),
      });

      // Log all args being used for debugging
      this.logger.debug("Initialize pool args:", {
        router: this.context.config.ccipRouterProgramId.toString(),
        rmn_remote: this.context.config.rmnRemoteProgramId.toString(),
      });

      // Create the instruction using the imported builder
      this.logger.debug("Creating initialize instruction...");
      const instruction = initialize(accounts, this.getProgramId());

      // Log instruction details
      this.logger.debug("Initialize instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

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

      // Derive pool signer PDA for the summary
      const [poolSignerPDA] = findPoolSignerPDA(mint, this.getProgramId());

      // Log important addresses for reference
      this.logger.info(`\n🎯 Pool Initialization Summary:`);
      this.logger.info(`   Token Mint:       ${mint.toString()}`);
      this.logger.info(`   Pool State PDA:   ${statePDA.toString()}`);
      this.logger.info(`   Pool Signer PDA:  ${poolSignerPDA.toString()}`);
      this.logger.info(
        `   Program ID:       ${this.getProgramId().toString()}`
      );
      this.logger.info(`   Transaction:      ${signature}`);

      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async initChainRemoteConfig(
    mint: PublicKey,
    remoteChainSelector: bigint,
    options: InitChainRemoteConfigOptions
  ): Promise<RemoteChainConfigResult> {
    const errorContext = {
      operation: "initChainRemoteConfig",
      mint: mint.toString(),
      destChainSelector: remoteChainSelector.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Initializing chain remote config for chain ${remoteChainSelector.toString()} on mint: ${mint.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Init chain remote config details:`, {
        mint: mint.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists (getPoolConfig will throw if not found)
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);

      // Check if signer is owner
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Verify chain config does NOT exist (this is an init operation)
      try {
        await this.accountReader.getChainConfig(mint, remoteChainSelector);
        throw new Error(
          `Chain config already exists for chain ${remoteChainSelector.toString()}. Use editChainRemoteConfig instead.`
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          throw error; // Re-throw our specific error
        }
        // Expected error - chain config doesn't exist, which is what we want
        this.logger.debug(
          `Chain config does not exist - proceeding with initialization`
        );
      }

      // Find the chain config PDA
      const [chainConfigPDA, chainConfigBump] = findBurnMintPoolChainConfigPDA(
        remoteChainSelector,
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `Chain config PDA: ${chainConfigPDA.toString()} (bump: ${chainConfigBump})`
      );
      this.logger.trace(
        `Chain config PDA derivation: seeds=[${TOKEN_POOL_CHAIN_CONFIG_SEED}, ${remoteChainSelector.toString()}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // For initialization, pool addresses MUST be empty (Rust program requirement)
      // Create RemoteAddresses from the provided addresses (if any)
      // Pool addresses use raw bytes (typically 20 bytes for Ethereum addresses)
      const remotePoolAddresses = (options.poolAddresses || [])
        .filter((addr) => addr && addr.trim() !== "") // Filter out empty strings
        .map((addr) => {
          const buffer = Buffer.from(addr, "hex");
          // No padding required for pool addresses - use raw bytes
          return new RemoteAddress({ address: buffer });
        });
      this.logger.debug(
        `Converted ${remotePoolAddresses.length} pool addresses`
      );

      // Validate and transform token address
      if (!options.tokenAddress) {
        throw new Error("Token address must be provided");
      }
      // Strip 0x prefix if present
      const cleanTokenAddress = options.tokenAddress.startsWith("0x")
        ? options.tokenAddress.slice(2)
        : options.tokenAddress;
      const rawTokenAddressBuffer = Buffer.from(cleanTokenAddress, "hex");
      // Token addresses need to be padded to 32 bytes (Ethereum-style)
      const tokenAddressBuffer = padTo32Bytes(rawTokenAddressBuffer);
      const remoteTokenAddress = new RemoteAddress({
        address: tokenAddressBuffer,
      });
      this.logger.debug(
        `Token address: ${options.tokenAddress} (cleaned: ${cleanTokenAddress}, padded to 32 bytes)`
      );

      // Validate decimals
      if (options.decimals < 0 || options.decimals > 18) {
        throw new Error("Invalid decimals value. Must be between 0 and 18.");
      }
      this.logger.debug(`Decimals: ${options.decimals}`);

      // Create RemoteConfig from options
      const remoteConfig: RemoteConfig = new RemoteConfig({
        poolAddresses: remotePoolAddresses,
        tokenAddress: remoteTokenAddress,
        decimals: options.decimals,
      });

      // Build the accounts for the init_chain_remote_config instruction
      const accounts: InitChainRemoteConfigAccounts = {
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Init chain remote config accounts:", {
        state: statePDA.toString(),
        chain_config: chainConfigPDA.toString(),
        authority: signerPublicKey.toString(),
        system_program: SystemProgram.programId.toString(),
      });

      // Build the args
      const args: InitChainRemoteConfigArgs = {
        remoteChainSelector: new BN(remoteChainSelector.toString()),
        mint: mint,
        cfg: remoteConfig.toEncodable(),
      };

      // Log all args being used for debugging
      this.logger.debug("Init chain remote config args:", {
        remote_chain_selector: remoteChainSelector.toString(),
        mint: mint.toString(),
        poolAddressCount: remotePoolAddresses.length,
        tokenAddress: options.tokenAddress,
        decimals: options.decimals,
      });

      // Create the instruction
      this.logger.debug("Creating init_chain_remote_config instruction...");
      const instruction = initChainRemoteConfig(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Init chain remote config instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "initChainRemoteConfig",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Chain remote config initialized: ${signature}`);

      // Parse event data
      let event: RemoteChainConfiguredEvent | undefined;
      try {
        event =
          await this.eventParser.parseRemoteChainConfiguredFromTransaction(
            this.context,
            signature
          );
      } catch (error) {
        this.logger.warn(`Failed to parse event from transaction: ${error}`);
      }

      return { signature, event };
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async getChainConfig(
    mint: PublicKey,
    remoteChainSelector: bigint
  ): Promise<any> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(
        `Getting chain config for mint: ${mint.toString()}, chain: ${remoteChainSelector.toString()}`
      );

      // Use the account reader to get the chain config
      const chainConfig = await this.accountReader.getChainConfig(
        mint,
        remoteChainSelector
      );

      this.logger.debug(`Chain config retrieved successfully`);
      return chainConfig;
    } catch (error) {
      throw enhanceError(error, {
        operation: "getChainConfig",
        mint: mint.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
      });
    }
  }

  /** @inheritDoc */
  async editChainRemoteConfig(
    mint: PublicKey,
    remoteChainSelector: bigint,
    options: EditChainRemoteConfigOptions
  ): Promise<RemoteChainConfigResult> {
    const errorContext = {
      operation: "editChainRemoteConfig",
      mint: mint.toString(),
      destChainSelector: remoteChainSelector.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Editing chain remote config for chain ${remoteChainSelector.toString()} on mint: ${mint.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Edit chain remote config details:`, {
        mint: mint.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists (getPoolConfig will throw if not found)
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);

      // Check if signer is owner
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Verify chain config EXISTS (this is an edit operation)
      await this.accountReader.getChainConfig(mint, remoteChainSelector);
      this.logger.debug(
        `Chain config exists for chain: ${remoteChainSelector.toString()}`
      );

      // Find the chain config PDA
      const [chainConfigPDA, chainConfigBump] = findBurnMintPoolChainConfigPDA(
        remoteChainSelector,
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `Chain config PDA: ${chainConfigPDA.toString()} (bump: ${chainConfigBump})`
      );
      this.logger.trace(
        `Chain config PDA derivation: seeds=[${TOKEN_POOL_CHAIN_CONFIG_SEED}, ${remoteChainSelector.toString()}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Validate and transform pool addresses from options
      if (!options.poolAddresses || options.poolAddresses.length === 0) {
        throw new Error("At least one pool address must be provided");
      }

      // Create RemoteAddresses from the provided addresses
      // Pool addresses use raw bytes (typically 20 bytes for Ethereum addresses)
      const remotePoolAddresses = options.poolAddresses.map((addr) => {
        // Strip 0x prefix if present for pool addresses
        const cleanPoolAddr = addr.startsWith("0x") ? addr.slice(2) : addr;
        const buffer = Buffer.from(cleanPoolAddr, "hex");
        // No padding required for pool addresses - use raw bytes
        return new RemoteAddress({ address: buffer });
      });
      this.logger.debug(
        `Converted ${remotePoolAddresses.length} pool addresses`
      );

      // Validate and transform token address
      if (!options.tokenAddress) {
        throw new Error("Token address must be provided");
      }
      // Strip 0x prefix if present
      const cleanTokenAddress = options.tokenAddress.startsWith("0x")
        ? options.tokenAddress.slice(2)
        : options.tokenAddress;
      const rawTokenAddressBuffer = Buffer.from(cleanTokenAddress, "hex");
      // Token addresses need to be padded to 32 bytes (Ethereum-style)
      const tokenAddressBuffer = padTo32Bytes(rawTokenAddressBuffer);
      const remoteTokenAddress = new RemoteAddress({
        address: tokenAddressBuffer,
      });
      this.logger.debug(
        `Token address: ${options.tokenAddress} (padded to 32 bytes)`
      );

      // Validate decimals
      if (options.decimals < 0 || options.decimals > 18) {
        throw new Error("Invalid decimals value. Must be between 0 and 18.");
      }
      this.logger.debug(`Decimals: ${options.decimals}`);

      // Create RemoteConfig from options
      const remoteConfig: RemoteConfig = new RemoteConfig({
        poolAddresses: remotePoolAddresses,
        tokenAddress: remoteTokenAddress,
        decimals: options.decimals,
      });

      // Build the accounts for the edit_chain_remote_config instruction
      const accounts: EditChainRemoteConfigAccounts = {
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Edit chain remote config accounts:", {
        state: statePDA.toString(),
        chain_config: chainConfigPDA.toString(),
        authority: signerPublicKey.toString(),
        system_program: SystemProgram.programId.toString(),
      });

      // Build the args
      const args: EditChainRemoteConfigArgs = {
        remoteChainSelector: new BN(remoteChainSelector.toString()),
        mint: mint,
        cfg: remoteConfig.toEncodable(),
      };

      // Log all args being used for debugging
      this.logger.debug("Edit chain remote config args:", {
        remoteChainSelector: remoteChainSelector.toString(),
        mint: mint.toString(),
        poolAddressCount: remotePoolAddresses.length,
        tokenAddress: options.tokenAddress,
        decimals: options.decimals,
      });

      // Create the instruction
      this.logger.debug("Creating edit_chain_remote_config instruction...");
      const instruction = editChainRemoteConfig(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Edit chain remote config instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "editChainRemoteConfig",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Chain remote config edited: ${signature}`);

      // Parse event data
      let event: RemoteChainConfiguredEvent | undefined;
      try {
        event =
          await this.eventParser.parseRemoteChainConfiguredFromTransaction(
            this.context,
            signature
          );
      } catch (error) {
        this.logger.warn(`Failed to parse event from transaction: ${error}`);
      }

      return { signature, event };
    } catch (error) {
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
      this.logger.debug(`Set rate limit details:`, {
        mint: mint.toString(),
        remoteChainSelector: remoteChainSelector.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // 3. Validation:
      //    a. Verify pool state exists
      const poolConfig = await this.accountReader.getPoolConfig(mint); // Throws if not found
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);
      this.logger.debug(
        `Rate limit admin: ${
          poolConfig.config.rateLimitAdmin?.toString() || "none"
        }`
      );

      //    b. Verify authority (Owner or Rate Limit Admin)
      const isOwner = poolConfig.config.owner.equals(signerPublicKey);
      // Check if rate_limit_admin exists on the config object before comparing
      const isRateAdmin =
        poolConfig.config.rateLimitAdmin &&
        poolConfig.config.rateLimitAdmin.equals(signerPublicKey);

      this.logger.debug(
        `Authorization check: isOwner=${isOwner}, isRateAdmin=${isRateAdmin}`
      );

      if (!isOwner && !isRateAdmin) {
        throw new Error(
          `Signer is not the owner or rate limit admin of the pool`
        );
      }

      //    c. Verify target chain config exists (No fallback/hardcoding)
      await this.accountReader.getChainConfig(mint, remoteChainSelector); // Throws if not found
      this.logger.debug(
        `Chain config exists for chain: ${remoteChainSelector.toString()}`
      );

      // 4. Prepare Accounts: Use correct types
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      const [chainConfigPDA, chainConfigBump] = findBurnMintPoolChainConfigPDA(
        remoteChainSelector,
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `Chain config PDA: ${chainConfigPDA.toString()} (bump: ${chainConfigBump})`
      );
      this.logger.trace(
        `Chain config PDA derivation: seeds=[${TOKEN_POOL_CHAIN_CONFIG_SEED}, ${remoteChainSelector.toString()}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      const accounts: SetChainRateLimitAccounts = {
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Set rate limit accounts:", {
        state: statePDA.toString(),
        chain_config: chainConfigPDA.toString(),
        authority: signerPublicKey.toString(),
      });

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
        remoteChainSelector: new BN(remoteChainSelector.toString()),
        mint: mint,
        inbound: inboundCfg.toEncodable(),
        outbound: outboundCfg.toEncodable(),
      };

      // Log all args being used for debugging
      this.logger.debug("Set rate limit args:", {
        remote_chain_selector: remoteChainSelector.toString(),
        mint: mint.toString(),
        inbound: {
          enabled: options.inbound.enabled,
          capacity: options.inbound.capacity.toString(),
          rate: options.inbound.rate.toString(),
        },
        outbound: {
          enabled: options.outbound.enabled,
          capacity: options.outbound.capacity.toString(),
          rate: options.outbound.rate.toString(),
        },
      });

      // 6. Create Instruction: Use correct builder
      this.logger.debug("Creating set_chain_rate_limit instruction...");
      const instruction = setChainRateLimit(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Set rate limit instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
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
      this.logger.debug(`Admin role transfer details:`, {
        mint: mint.toString(),
        newAdmin: options.newAdmin.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);
      this.logger.debug(
        `Current proposed owner: ${
          poolConfig.config.proposedOwner?.toString() || "none"
        }`
      );

      // Check if signer is owner
      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Build the accounts
      const accounts: TransferOwnershipAccounts = {
        state: statePDA,
        mint: mint,
        authority: signerPublicKey,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Transfer admin role accounts:", {
        state: statePDA.toString(),
        mint: mint.toString(),
        authority: signerPublicKey.toString(),
      });

      // Build the args
      const args: TransferOwnershipArgs = {
        proposedOwner: options.newAdmin,
      };

      // Log all args being used for debugging
      this.logger.debug("Transfer admin role args:", {
        proposed_owner: options.newAdmin.toString(),
      });

      // Create the instruction
      this.logger.debug("Creating transfer_ownership instruction...");
      const instruction = transferOwnership(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Transfer admin role instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
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
      this.logger.debug(`Accept admin role details:`, {
        mint: mint.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists and fetch config
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);
      this.logger.debug(
        `Current proposed owner: ${
          poolConfig.config.proposedOwner?.toString() || "none"
        }`
      );

      // Check if signer is the proposed owner
      // Ensure proposed_owner is not null/default before comparing
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
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Build the accounts
      const accounts: AcceptOwnershipAccounts = {
        state: statePDA,
        mint: mint,
        authority: signerPublicKey, // The caller (proposed owner) is the authority here
      };

      // Log all accounts being used for debugging
      this.logger.debug("Accept admin role accounts:", {
        state: statePDA.toString(),
        mint: mint.toString(),
        authority: signerPublicKey.toString(),
      });

      // Create the instruction (accept_ownership has no args)
      this.logger.debug("Creating accept_ownership instruction...");
      const instruction = acceptOwnership(accounts, this.getProgramId());

      // Log instruction details
      this.logger.debug("Accept admin role instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

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
      this.logger.debug(`Router update details:`, {
        mint: mint.toString(),
        newRouter: options.newRouter.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(
        `Current router: ${poolConfig.config.router.toString()}`
      );

      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Find the program data PDA for this program
      const [programDataPDA, programDataBump] = findProgramDataPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Program data PDA: ${programDataPDA.toString()} (bump: ${programDataBump})`
      );
      this.logger.trace(
        `Program data PDA derivation: seeds=[${this.getProgramId().toString()}], program=BPF_LOADER_UPGRADEABLE_PROGRAM_ID`
      );

      // Build the accounts
      const accounts: SetRouterAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
        program: this.getProgramId(),
        programData: programDataPDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Set router accounts:", {
        state: statePDA.toString(),
        mint: mint.toString(),
        authority: signerPublicKey.toString(),
        program: this.getProgramId().toString(),
        programData: programDataPDA.toString(),
      });

      // Build the args
      const args: SetRouterArgs = {
        newRouter: options.newRouter,
      };

      // Log all args being used for debugging
      this.logger.debug("Set router args:", {
        newRouter: options.newRouter.toString(),
      });

      // Create the instruction
      this.logger.debug("Creating set_router instruction...");
      const instruction = setRouter(args, accounts, this.getProgramId());

      // Log instruction details
      this.logger.debug("Set router instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
      );

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

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Initialize state version details:`, {
        mint: mint.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Note: This operation is permissionless - no owner check needed
      this.logger.debug(
        `Operation is permissionless - no ownership validation required`
      );

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Build the accounts
      const accounts: InitializeStateVersionAccounts = {
        state: statePDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Initialize state version accounts:", {
        state: statePDA.toString(),
      });

      // Create the args
      const args: InitializeStateVersionArgs = {
        mint: mint,
      };

      // Log all args being used for debugging
      this.logger.debug("Initialize state version args:", {
        mint: mint.toString(),
      });

      // Create the instruction
      this.logger.debug("Creating initializeStateVersion instruction...");
      const instruction = initializeStateVersion(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Initialize state version instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
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
      this.logger.debug(`Configure allowlist details:`, {
        mint: mint.toString(),
        enabled: options.enabled,
        addCount: options.add.length,
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);

      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Build the accounts
      const accounts: ConfigureAllowListAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Configure allowlist accounts:", {
        state: statePDA.toString(),
        mint: mint.toString(),
        authority: signerPublicKey.toString(),
        systemProgram: SystemProgram.programId.toString(),
      });

      // Build the args
      const args: ConfigureAllowListArgs = {
        add: options.add,
        enabled: options.enabled,
      };

      // Log all args being used for debugging
      this.logger.debug("Configure allowlist args:", {
        enabled: options.enabled,
        addAddresses: options.add.map((addr) => addr.toString()),
      });

      // Create the instruction
      this.logger.debug("Creating configureAllowList instruction...");
      const instruction = configureAllowList(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Configure allowlist instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
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
      this.logger.debug(`Remove from allowlist details:`, {
        mint: mint.toString(),
        removeCount: options.remove.length,
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);

      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Build the accounts
      const accounts: RemoveFromAllowListAccounts = {
        state: statePDA,
        mint,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Remove from allowlist accounts:", {
        state: statePDA.toString(),
        mint: mint.toString(),
        authority: signerPublicKey.toString(),
        system_program: SystemProgram.programId.toString(),
      });

      // Build the args
      const args: RemoveFromAllowListArgs = {
        remove: options.remove,
      };

      // Log all args being used for debugging
      this.logger.debug("Remove from allowlist args:", {
        removeAddresses: options.remove.map((addr) => addr.toString()),
      });

      // Create the instruction
      this.logger.debug("Creating removeFromAllowList instruction...");
      const instruction = removeFromAllowList(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Remove from allowlist instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
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
      this.logger.debug(`Append remote pool addresses details:`, {
        mint: mint.toString(),
        remoteChainSelector: options.remoteChainSelector.toString(),
        addressCount: options.addresses.length,
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);

      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Verify chain configuration exists
      await this.accountReader.getChainConfig(
        mint,
        options.remoteChainSelector
      );
      this.logger.debug(
        `Chain config exists for chain: ${options.remoteChainSelector.toString()}`
      );

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Find the chain config PDA
      const [chainConfigPDA, chainConfigBump] = findBurnMintPoolChainConfigPDA(
        options.remoteChainSelector,
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `Chain config PDA: ${chainConfigPDA.toString()} (bump: ${chainConfigBump})`
      );
      this.logger.trace(
        `Chain config PDA derivation: seeds=[${TOKEN_POOL_CHAIN_CONFIG_SEED}, ${options.remoteChainSelector.toString()}, ${mint.toString()}], program=${this.getProgramId().toString()}`
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
      this.logger.debug(
        `Converted ${remoteAddresses.length} hex addresses to RemoteAddress objects`
      );

      // Build the accounts
      const accounts: AppendRemotePoolAddressesAccounts = {
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
        systemProgram: SystemProgram.programId,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Append remote pool addresses accounts:", {
        state: statePDA.toString(),
        chain_config: chainConfigPDA.toString(),
        authority: signerPublicKey.toString(),
        system_program: SystemProgram.programId.toString(),
      });

      // Build the args
      const args: AppendRemotePoolAddressesArgs = {
        remoteChainSelector: new BN(options.remoteChainSelector.toString()),
        addresses: remoteAddresses,
        mint: mint,
      };

      // Log all args being used for debugging
      this.logger.debug("Append remote pool addresses args:", {
        remote_chain_selector: options.remoteChainSelector.toString(),
        addressCount: remoteAddresses.length,
        _mint: mint.toString(),
      });

      // Create the instruction
      this.logger.debug("Creating append_remote_pool_addresses instruction...");
      const instruction = appendRemotePoolAddresses(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Append remote pool addresses instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
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
      this.logger.debug(`Delete chain config details:`, {
        mint: mint.toString(),
        remoteChainSelector: options.remoteChainSelector.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists and signer is owner
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(`Current owner: ${poolConfig.config.owner.toString()}`);

      if (!poolConfig.config.owner.equals(signerPublicKey)) {
        throw new Error(`Signer is not the owner of the pool`);
      }

      // Verify chain configuration exists
      await this.accountReader.getChainConfig(
        mint,
        options.remoteChainSelector
      );
      this.logger.debug(
        `Chain config exists for chain: ${options.remoteChainSelector.toString()}`
      );

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );
      this.logger.trace(
        `State PDA derivation: seeds=[${TOKEN_POOL_STATE_SEED}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Find the chain config PDA
      const [chainConfigPDA, chainConfigBump] = findBurnMintPoolChainConfigPDA(
        options.remoteChainSelector,
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `Chain config PDA: ${chainConfigPDA.toString()} (bump: ${chainConfigBump})`
      );
      this.logger.trace(
        `Chain config PDA derivation: seeds=[${TOKEN_POOL_CHAIN_CONFIG_SEED}, ${options.remoteChainSelector.toString()}, ${mint.toString()}], program=${this.getProgramId().toString()}`
      );

      // Build the accounts
      const accounts: DeleteChainConfigAccounts = {
        state: statePDA,
        chainConfig: chainConfigPDA,
        authority: signerPublicKey,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Delete chain config accounts:", {
        state: statePDA.toString(),
        chain_config: chainConfigPDA.toString(),
        authority: signerPublicKey.toString(),
      });

      // Create the instruction with args
      const args: DeleteChainConfigArgs = {
        remoteChainSelector: new BN(options.remoteChainSelector.toString()),
        mint,
      };

      // Log all args being used for debugging
      this.logger.debug("Delete chain config args:", {
        remote_chain_selector: options.remoteChainSelector.toString(),
        mint: mint.toString(),
      });

      this.logger.debug("Creating delete_chain_config instruction...");
      const instruction = deleteChainConfig(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Delete chain config instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });
      this.logger.trace("Instruction accounts:", {
        keys: instruction.keys.map((key, index) => ({
          index,
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      });
      this.logger.trace(
        `Instruction data (hex): ${instruction.data.toString("hex")}`
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

  /** @inheritDoc */
  async updateSelfServedAllowed(
    options: UpdateSelfServedAllowedOptions
  ): Promise<string> {
    const errorContext = {
      operation: "updateSelfServedAllowed",
      selfServedAllowed: String(options.selfServedAllowed),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Updating global self-served allowed flag to: ${options.selfServedAllowed}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Update self-served allowed details:`, {
        selfServedAllowed: options.selfServedAllowed,
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Find the global config PDA
      const [globalConfigPDA, globalConfigBump] = findGlobalConfigPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Global config PDA: ${globalConfigPDA.toString()} (bump: ${globalConfigBump})`
      );

      // Find the program data PDA
      const [programDataPDA, programDataBump] = findProgramDataPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Program data PDA: ${programDataPDA.toString()} (bump: ${programDataBump})`
      );

      // Build the accounts
      const accounts: UpdateSelfServedAllowedAccounts = {
        config: globalConfigPDA,
        authority: signerPublicKey,
        program: this.getProgramId(),
        programData: programDataPDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Update self-served allowed accounts:", {
        config: globalConfigPDA.toString(),
        authority: signerPublicKey.toString(),
        program: this.getProgramId().toString(),
        programData: programDataPDA.toString(),
      });

      // Build the args
      const args: UpdateSelfServedAllowedArgs = {
        selfServedAllowed: options.selfServedAllowed,
      };

      // Log all args being used for debugging
      this.logger.debug("Update self-served allowed args:", {
        selfServedAllowed: options.selfServedAllowed,
      });

      // Create the instruction
      this.logger.debug("Creating updateSelfServedAllowed instruction...");
      const instruction = updateSelfServedAllowed(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Update self-served allowed instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "updateSelfServedAllowed",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Global self-served allowed updated: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async updateDefaultRouter(
    options: UpdateDefaultRouterOptions
  ): Promise<string> {
    const errorContext = {
      operation: "updateDefaultRouter",
      routerAddress: options.routerAddress.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Updating global default router to: ${options.routerAddress.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Update default router details:`, {
        routerAddress: options.routerAddress.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Find the global config PDA
      const [globalConfigPDA, globalConfigBump] = findGlobalConfigPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Global config PDA: ${globalConfigPDA.toString()} (bump: ${globalConfigBump})`
      );

      // Find the program data PDA
      const [programDataPDA, programDataBump] = findProgramDataPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Program data PDA: ${programDataPDA.toString()} (bump: ${programDataBump})`
      );

      // Build the accounts
      const accounts: UpdateDefaultRouterAccounts = {
        config: globalConfigPDA,
        authority: signerPublicKey,
        program: this.getProgramId(),
        programData: programDataPDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Update default router accounts:", {
        config: globalConfigPDA.toString(),
        authority: signerPublicKey.toString(),
        program: this.getProgramId().toString(),
        programData: programDataPDA.toString(),
      });

      // Build the args
      const args: UpdateDefaultRouterArgs = {
        routerAddress: options.routerAddress,
      };

      // Log all args being used for debugging
      this.logger.debug("Update default router args:", {
        routerAddress: options.routerAddress.toString(),
      });

      // Create the instruction
      this.logger.debug("Creating updateDefaultRouter instruction...");
      const instruction = updateDefaultRouter(
        args,
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug("Update default router instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "updateDefaultRouter",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Global default router updated: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async updateDefaultRmn(options: UpdateDefaultRmnOptions): Promise<string> {
    const errorContext = {
      operation: "updateDefaultRmn",
      rmnAddress: options.rmnAddress.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Updating global default RMN to: ${options.rmnAddress.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Update default RMN details:`, {
        rmnAddress: options.rmnAddress.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Find the global config PDA
      const [globalConfigPDA, globalConfigBump] = findGlobalConfigPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Global config PDA: ${globalConfigPDA.toString()} (bump: ${globalConfigBump})`
      );

      // Find the program data PDA
      const [programDataPDA, programDataBump] = findProgramDataPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Program data PDA: ${programDataPDA.toString()} (bump: ${programDataBump})`
      );

      // Build the accounts
      const accounts: UpdateDefaultRmnAccounts = {
        config: globalConfigPDA,
        authority: signerPublicKey,
        program: this.getProgramId(),
        programData: programDataPDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Update default RMN accounts:", {
        config: globalConfigPDA.toString(),
        authority: signerPublicKey.toString(),
        program: this.getProgramId().toString(),
        programData: programDataPDA.toString(),
      });

      // Build the args
      const args: UpdateDefaultRmnArgs = {
        rmnAddress: options.rmnAddress,
      };

      // Log all args being used for debugging
      this.logger.debug("Update default RMN args:", {
        rmnAddress: options.rmnAddress.toString(),
      });

      // Create the instruction
      this.logger.debug("Creating updateDefaultRmn instruction...");
      const instruction = updateDefaultRmn(args, accounts, this.getProgramId());

      // Log instruction details
      this.logger.debug("Update default RMN instruction created:", {
        programId: this.getProgramId().toString(),
        dataLength: instruction.data.length,
        keyCount: instruction.keys.length,
      });

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "updateDefaultRmn",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Global default RMN updated: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }

  /** @inheritDoc */
  async transferMintAuthorityToMultisig(
    mint: PublicKey,
    options: TransferMintAuthorityToMultisigOptions
  ): Promise<string> {
    const errorContext = {
      operation: "transferMintAuthorityToMultisig",
      mint: mint.toString(),
      newMultisigMintAuthority: options.newMultisigMintAuthority.toString(),
    };
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.info(
        `Transferring mint authority for mint: ${mint.toString()} to multisig: ${options.newMultisigMintAuthority.toString()}`
      );

      const signerPublicKey = this.context.provider.getAddress();
      this.logger.debug(`Transfer mint authority details:`, {
        mint: mint.toString(),
        newMultisigMintAuthority: options.newMultisigMintAuthority.toString(),
        signer: signerPublicKey.toString(),
        programId: this.getProgramId().toString(),
      });

      // Verify pool exists (will be needed for pool signer derivation)
      const poolConfig = await this.accountReader.getPoolConfig(mint);
      this.logger.debug(
        `Pool exists with owner: ${poolConfig.config.owner.toString()}`
      );

      // Find the state PDA
      const [statePDA, stateBump] = findBurnMintPoolConfigPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `State PDA: ${statePDA.toString()} (bump: ${stateBump})`
      );

      // Find the pool signer PDA
      const [poolSignerPDA, poolSignerBump] = findPoolSignerPDA(
        mint,
        this.getProgramId()
      );
      this.logger.debug(
        `Pool signer PDA: ${poolSignerPDA.toString()} (bump: ${poolSignerBump})`
      );

      // Find the program data PDA
      const [programDataPDA, programDataBump] = findProgramDataPDA(
        this.getProgramId()
      );
      this.logger.debug(
        `Program data PDA: ${programDataPDA.toString()} (bump: ${programDataBump})`
      );

      // Get the token program from the mint account
      const mintAccount = await this.context.provider.connection.getAccountInfo(
        mint
      );
      if (!mintAccount) {
        throw new Error(`Mint account not found: ${mint.toString()}`);
      }
      const tokenProgram = mintAccount.owner;
      this.logger.debug(`Token program: ${tokenProgram.toString()}`);

      // Build the accounts
      const accounts: TransferMintAuthorityToMultisigAccounts = {
        state: statePDA,
        mint,
        tokenProgram,
        poolSigner: poolSignerPDA,
        authority: signerPublicKey,
        newMultisigMintAuthority: options.newMultisigMintAuthority,
        program: this.getProgramId(),
        programData: programDataPDA,
      };

      // Log all accounts being used for debugging
      this.logger.debug("Transfer mint authority to multisig accounts:", {
        state: statePDA.toString(),
        mint: mint.toString(),
        tokenProgram: tokenProgram.toString(),
        poolSigner: poolSignerPDA.toString(),
        authority: signerPublicKey.toString(),
        newMultisigMintAuthority: options.newMultisigMintAuthority.toString(),
        program: this.getProgramId().toString(),
        programData: programDataPDA.toString(),
      });

      // Create the instruction (this function has no args, only accounts)
      this.logger.debug(
        "Creating transferMintAuthorityToMultisig instruction..."
      );
      const instruction = transferMintAuthorityToMultisig(
        accounts,
        this.getProgramId()
      );

      // Log instruction details
      this.logger.debug(
        "Transfer mint authority to multisig instruction created:",
        {
          programId: this.getProgramId().toString(),
          dataLength: instruction.data.length,
          keyCount: instruction.keys.length,
        }
      );

      // Execute the transaction using the shared utility
      const executionOptions: TransactionExecutionOptions = {
        ...extractTxOptions(options),
        errorContext,
        operationName: "transferMintAuthorityToMultisig",
      };

      const signature = await executeTransaction(
        this.context,
        [instruction],
        executionOptions
      );

      this.logger.info(`Mint authority transferred to multisig: ${signature}`);
      return signature;
    } catch (error) {
      throw enhanceError(error, errorContext);
    }
  }
}
