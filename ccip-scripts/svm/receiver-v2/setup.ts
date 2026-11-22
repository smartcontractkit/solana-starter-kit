/**
 * CCIP v2 Receiver Setup Script
 *
 * Prepares programs/ccip-receiver-v2 to receive CCIP 2.0 messages, including
 * Faster-Than-Finality (FTF) data messages:
 *   1. initialize            - creates the state + messages_storage PDAs (router = config router)
 *   2. register_with_router  - registers the program as a v2 receiver in the router's ReceiverRegistry
 *   3. set_ccv_config        - sets the allowed source finality (FTF policy) for a source chain
 *
 * Each step is skipped when already done, so the script is safe to re-run.
 * Use --dry-run to simulate all pending steps in a single transaction without sending anything.
 */

import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { CHAIN_SELECTORS, ChainId, getExplorerUrl, resolveNetworkConfig } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { ArgumentDefinition, BaseCommandOptions, CCIPCommand, CommandMetadata } from "../utils/cli-framework";
import {
  BPF_UPGRADEABLE_LOADER,
  FINALITY_FLAG_SAFE,
  RECEIVER_VERSION_V2,
  deriveReceiverV2Pdas,
  describeFinalityConfig,
  loadReceiverV2Program,
  parseReceiverRegistry,
  resolveReceiverV2ProgramId,
} from "./common";

interface SetupOptions extends BaseCommandOptions {
  programId?: string;
  sourceChain?: string;
  blockDepth?: number;
  allowSafe?: boolean;
  updateRouter?: boolean;
  dryRun?: boolean;
}

class SetupReceiverV2Command extends CCIPCommand<SetupOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "receiver-v2:setup",
      description:
        "🔧 CCIP v2 Receiver Setup\n\nInitializes programs/ccip-receiver-v2, registers it with the CCIP 2.0 Router as a v2 receiver, and sets its Faster-Than-Finality policy for a source chain.",
      examples: [
        "# Simulate all pending steps (no transactions sent)",
        "yarn svm:receiver-v2:setup --dry-run",
        "",
        "# Accept messages from Sepolia after >= 1 block confirmation",
        "yarn svm:receiver-v2:setup --block-depth 1",
        "",
        "# Also accept the source chain's `safe` tag",
        "yarn svm:receiver-v2:setup --block-depth 1 --allow-safe",
        "",
        "# Only accept finalized messages (disables FTF)",
        "yarn svm:receiver-v2:setup --block-depth 0",
        "",
        "# Re-point an already-initialized receiver to the config router (e.g. after a router upgrade)",
        "yarn svm:receiver-v2:setup --update-router",
      ],
      notes: [
        "Program must be deployed first: yarn svm:receiver-v2:deploy",
        "initialize must be signed by the program's upgrade authority",
        "--update-router re-points state.router to the config router and re-registers there (owner only)",
        "--block-depth N allows any FTF request waiting >= N blocks (0 = finalized only)",
        "The lane's executor/verifiers/pools must also allow the requested finality",
      ],
    };
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      { name: "program-id", type: "string", description: "Receiver v2 program ID (default: config receiverV2ProgramId)" },
      { name: "source-chain", type: "string", defaultValue: ChainId.ETHEREUM_SEPOLIA, description: "Source chain to configure", example: "ethereum-sepolia" },
      { name: "block-depth", type: "number", defaultValue: 1, description: "Minimum allowed FTF block depth (0 = finalized only)", example: "1" },
      { name: "allow-safe", type: "boolean", defaultValue: false, description: "Also allow the `safe` finality tag" },
      { name: "update-router", type: "boolean", defaultValue: false, description: "Re-point state.router to the config router before registering (owner only)" },
      { name: "dry-run", type: "boolean", defaultValue: false, description: "Simulate only; do not send transactions" },
    ];
  }

  protected async execute(): Promise<void> {
    const config = resolveNetworkConfig(this.options);
    const wallet = loadKeypair(getKeypairPath(this.options));
    const connection = config.connection;
    const programId = resolveReceiverV2ProgramId(config, this.options.programId);

    const sourceChain = (this.options.sourceChain || ChainId.ETHEREUM_SEPOLIA) as ChainId;
    const sourceChainSelector = CHAIN_SELECTORS[sourceChain];
    if (sourceChainSelector === undefined) throw new Error(`Unknown source chain: ${sourceChain}`);

    const blockDepth = Number(this.options.blockDepth ?? 1);
    if (!Number.isInteger(blockDepth) || blockDepth < 0 || blockDepth > 0xffff) {
      throw new Error("--block-depth must be an integer 0-65535");
    }
    const flags = this.options.allowSafe ? FINALITY_FLAG_SAFE : 0;

    const router = config.routerProgramId;
    const pdas = deriveReceiverV2Pdas(programId, router, sourceChainSelector);

    this.logger.info("🔧 CCIP v2 Receiver Setup");
    this.logger.info("==========================================");
    this.logger.info(`Network:      ${config.id}`);
    this.logger.info(`Wallet:       ${wallet.publicKey.toBase58()}`);
    this.logger.info(`Receiver v2:  ${programId.toBase58()}`);
    this.logger.info(`Router:       ${router.toBase58()}`);
    this.logger.info(`Source chain: ${sourceChain} (${sourceChainSelector})`);
    this.logger.info(`FTF policy:   flags=${flags} block_depth=${blockDepth} → accepts ${describeFinalityConfig(flags, blockDepth)}`);
    this.logger.info(`Mode:         ${this.options.dryRun ? "DRY RUN (simulation only)" : "LIVE"}`);

    const programInfo = await connection.getAccountInfo(programId);
    if (!programInfo?.executable) {
      throw new Error(`Program ${programId.toBase58()} is not deployed. Run: yarn svm:receiver-v2:deploy`);
    }
    const balance = await connection.getBalance(wallet.publicKey);
    this.logger.info(`SOL Balance:  ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    const program = loadReceiverV2Program(wallet, config, programId);
    const [stateInfo, registryInfo, ccvInfo] = await connection.getMultipleAccountsInfo([
      pdas.state,
      pdas.receiverRegistry,
      pdas.ccvConfig,
    ]);

    const steps: { name: string; ix: TransactionInstruction }[] = [];

    // 1. initialize
    if (stateInfo) {
      const state: any = await (program.account as any).baseState.fetch(pdas.state);
      if (!state.owner.equals(wallet.publicKey)) {
        throw new Error(`Wallet is not the receiver owner (${state.owner.toBase58()})`);
      }
      if (!state.router.equals(router)) {
        if (!this.options.updateRouter) {
          throw new Error(
            `Receiver router ${state.router.toBase58()} != config router ${router.toBase58()}. ` +
              `Re-run with --update-router to re-point the receiver (owner only).`
          );
        }
        this.logger.info(
          `\n⏳ [1/3] update_router: ${state.router.toBase58()} → ${router.toBase58()} (re-registering with the new router)`
        );
        steps.push({
          name: "update_router",
          ix: await program.methods
            .updateRouter(router)
            .accountsStrict({
              state: pdas.state,
              authority: wallet.publicKey,
            })
            .instruction(),
        });
      } else {
        this.logger.info(`\n✅ [1/3] Already initialized (owner ${state.owner.toBase58()}, router ${state.router.toBase58()})`);
      }
    } else {
      const [programData] = PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_UPGRADEABLE_LOADER);
      this.logger.info(`\n⏳ [1/3] initialize (router ${router.toBase58()})`);
      steps.push({
        name: "initialize",
        ix: await program.methods
          .initialize(router)
          .accountsStrict({
            state: pdas.state,
            messagesStorage: pdas.messagesStorage,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
            program: programId,
            programData,
          })
          .instruction(),
      });
    }

    // 2. register_with_router
    const registry = registryInfo?.owner.equals(router) ? parseReceiverRegistry(registryInfo.data) : undefined;
    if (registry?.receiverVersion === RECEIVER_VERSION_V2) {
      this.logger.info(`✅ [2/3] Already registered as a v2 receiver (registry ${pdas.receiverRegistry.toBase58()})`);
    } else {
      this.logger.info(`⏳ [2/3] register_with_router (registry ${pdas.receiverRegistry.toBase58()})`);
      steps.push({
        name: "register_with_router",
        ix: await program.methods
          .registerWithRouter()
          .accountsStrict({
            state: pdas.state,
            authority: wallet.publicKey,
            registrationSigner: pdas.registrationSigner,
            routerProgram: router,
            receiverRegistry: pdas.receiverRegistry,
            routerConfig: pdas.routerConfig,
            routerEventAuthority: pdas.routerEventAuthority,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      });
    }

    // 3. set_ccv_config
    let ccvUpToDate = false;
    if (ccvInfo) {
      const cfg: any = await (program.account as any).sourceChainCcvConfig.fetch(pdas.ccvConfig);
      const cur = cfg.allowedFinalityConfig;
      ccvUpToDate =
        cur.flags === flags && cur.blockDepth === blockDepth && cfg.requiredCcvs.length === 0 && cfg.optionalCcvs.length === 0;
      this.logger.info(`   Current ccv_config: flags=${cur.flags} block_depth=${cur.blockDepth}`);
    }
    if (ccvUpToDate) {
      this.logger.info(`✅ [3/3] CCV/finality config already set (${pdas.ccvConfig.toBase58()})`);
    } else {
      this.logger.info(`⏳ [3/3] set_ccv_config (${pdas.ccvConfig.toBase58()})`);
      steps.push({
        name: "set_ccv_config",
        ix: await program.methods
          .setCcvConfig({
            sourceChainSelector: new BN(sourceChainSelector.toString()),
            requiredCcvs: [],
            optionalCcvs: [],
            optionalThreshold: 0,
            allowedFinalityConfig: { flags, blockDepth },
          })
          .accountsStrict({
            state: pdas.state,
            sourceChainCcvConfig: pdas.ccvConfig,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      });
    }

    if (steps.length === 0) {
      this.logger.info("\n🎉 Nothing to do: receiver is fully set up.");
      return;
    }

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(...steps.map((s) => s.ix));
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    this.logger.info(`\n🧪 Simulating: ${steps.map((s) => s.name).join(" + ")}`);
    const sim = await connection.simulateTransaction(tx, [wallet]);
    if (sim.value.err) {
      (sim.value.logs || []).forEach((l) => this.logger.error(l));
      throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
    }
    (sim.value.logs || []).forEach((l) => this.logger.debug(l));
    this.logger.info(`✅ Simulation succeeded (${sim.value.unitsConsumed} CU)`);

    if (this.options.dryRun) {
      this.logger.info("\nDry run: no transaction sent. Re-run without --dry-run to apply.");
      return;
    }

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet], { commitment: "confirmed" });
    this.logger.info(`\n🎉 Setup complete: ${sig}`);
    this.logger.info(`🔍 ${getExplorerUrl(config.id, sig)}`);
    this.logger.info("\nNext: yarn svm:receiver-v2:status");
  }
}

new SetupReceiverV2Command().run().catch(() => process.exit(1));
