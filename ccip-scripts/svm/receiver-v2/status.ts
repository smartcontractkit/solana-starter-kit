/**
 * CCIP v2 Receiver Status Script
 *
 * Shows the deployment/registration/FTF configuration of programs/ccip-receiver-v2
 * and decodes the latest received message. Read-only: sends no transactions.
 */

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { CHAIN_SELECTORS, ChainId, resolveNetworkConfig } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { ArgumentDefinition, BaseCommandOptions, CCIPCommand, CommandMetadata } from "../utils/cli-framework";
import {
  BPF_UPGRADEABLE_LOADER,
  RECEIVER_VERSION_V2,
  deriveReceiverV2Pdas,
  describeFinalityConfig,
  loadReceiverV2Program,
  parseReceiverRegistry,
  resolveReceiverV2ProgramId,
} from "./common";

interface StatusOptions extends BaseCommandOptions {
  programId?: string;
  sourceChain?: string;
}

function decodeData(data: Buffer): string {
  const text = data.toString("utf8");
  return /^[\x20-\x7e\s]*$/.test(text) ? `"${text}"` : `0x${data.toString("hex")}`;
}

class ReceiverV2StatusCommand extends CCIPCommand<StatusOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "receiver-v2:status",
      description: "📊 CCIP v2 Receiver Status\n\nShows deployment, router registration, FTF policy and the latest received message.",
      examples: ["yarn svm:receiver-v2:status", "yarn svm:receiver-v2:status --source-chain ethereum-sepolia"],
    };
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      { name: "program-id", type: "string", description: "Receiver v2 program ID (default: config receiverV2ProgramId)" },
      { name: "source-chain", type: "string", defaultValue: ChainId.ETHEREUM_SEPOLIA, description: "Source chain whose FTF policy to show" },
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

    const router = config.routerProgramId;
    const pdas = deriveReceiverV2Pdas(programId, router, sourceChainSelector);
    const [programData] = PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_UPGRADEABLE_LOADER);

    this.logger.info("📊 CCIP v2 Receiver Status");
    this.logger.info("==========================================");
    this.logger.info(`Network:     ${config.id}`);
    this.logger.info(`Receiver v2: ${programId.toBase58()}`);
    this.logger.info(`Router:      ${router.toBase58()}`);

    const [programInfo, programDataInfo, stateInfo, storageInfo, registryInfo, ccvInfo] =
      await connection.getMultipleAccountsInfo([
        programId,
        programData,
        pdas.state,
        pdas.messagesStorage,
        pdas.receiverRegistry,
        pdas.ccvConfig,
      ]);

    let ready = true;
    const check = (ok: boolean, label: string, detail = "") => {
      if (!ok) ready = false;
      this.logger.info(`${ok ? "✅" : "❌"} ${label}${detail ? `: ${detail}` : ""}`);
    };

    this.logger.info("");
    check(!!programInfo?.executable, "Program deployed");
    if (programDataInfo && programDataInfo.data.length >= 45 && programDataInfo.data[12] === 1) {
      this.logger.info(`   Upgrade authority: ${new PublicKey(programDataInfo.data.subarray(13, 45)).toBase58()}`);
    }
    if (!programInfo?.executable) {
      this.logger.info("\nDeploy with: yarn svm:receiver-v2:deploy");
      return;
    }

    const program = loadReceiverV2Program(wallet, config, programId);

    if (stateInfo) {
      const state: any = await (program.account as any).baseState.fetch(pdas.state);
      check(state.router.equals(router), "Initialized", `owner ${state.owner.toBase58()}, router ${state.router.toBase58()}`);
    } else {
      check(false, "Initialized", `state PDA ${pdas.state.toBase58()} missing`);
    }

    const registry = registryInfo?.owner.equals(router) ? parseReceiverRegistry(registryInfo.data) : undefined;
    check(
      registry?.receiverVersion === RECEIVER_VERSION_V2 && registry.receiverProgram.equals(programId),
      "Registered with router as v2",
      registry ? `receiver_version=${registry.receiverVersion} (${pdas.receiverRegistry.toBase58()})` : `registry ${pdas.receiverRegistry.toBase58()} missing → OffRamp treats it as v1 (finalized only, no ccip_receive_v2)`
    );

    if (ccvInfo) {
      const cfg: any = await (program.account as any).sourceChainCcvConfig.fetch(pdas.ccvConfig);
      const f = cfg.allowedFinalityConfig;
      check(true, `CCV config for ${sourceChain}`, `flags=${f.flags} block_depth=${f.blockDepth} → accepts ${describeFinalityConfig(f.flags, f.blockDepth)}`);
      this.logger.info(`   required CCVs: ${cfg.requiredCcvs.length ? cfg.requiredCcvs.map((k: PublicKey) => k.toBase58()).join(", ") : "(lane defaults)"}`);
      this.logger.info(`   optional CCVs: ${cfg.optionalCcvs.length} (threshold ${cfg.optionalThreshold})`);
    } else {
      this.logger.info(`⚠️  No CCV config for ${sourceChain}: lane defaults, finalized only (no FTF)`);
    }

    // What the OffRamp will see when it queries the receiver
    if (stateInfo) {
      try {
        const out: any = await program.methods
          .getCcvsAndFinalityConfig({ sourceChainSelector: new BN(sourceChainSelector.toString()), sender: Buffer.alloc(0) })
          .accountsStrict({ sourceChainCcvConfig: pdas.ccvConfig })
          .view();
        const f = out.allowedFinalityConfig;
        this.logger.info(`   get_ccvs_and_finality_config → flags=${f.flags} block_depth=${f.blockDepth}`);
      } catch (e) {
        this.logger.warn(`   get_ccvs_and_finality_config simulation failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    this.logger.info("\n📨 LATEST MESSAGE");
    this.logger.info("==========================================");
    if (!storageInfo) {
      this.logger.info("messages_storage not initialized");
    } else {
      const storage: any = await (program.account as any).messagesStorage.fetch(pdas.messagesStorage);
      const count = storage.messageCount.toString();
      this.logger.info(`Messages received: ${count}`);
      if (count !== "0") {
        const m = storage.latestMessage;
        this.logger.info(`Message ID:   0x${Buffer.from(m.messageId).toString("hex")}`);
        this.logger.info(`Source chain: ${m.sourceChainSelector.toString()}`);
        this.logger.info(`Sender:       0x${Buffer.from(m.sender).toString("hex")}`);
        this.logger.info(`Data:         ${decodeData(Buffer.from(m.data))}`);
        this.logger.info(`Received at:  ${new Date(Number(m.receivedTimestamp.toString()) * 1000).toISOString()}`);
        if (m.tokenTransfer) {
          const t = m.tokenTransfer;
          this.logger.info(`Token:        ${t.tokenAmount.amount.toString()} of ${t.tokenAmount.token.toBase58()} → ${t.tokenReceiver.toBase58()}`);
        }
      }
    }

    this.logger.info(`\n${ready ? "🎉 Ready for CCIP 2.0 (incl. FTF) messages" : "⚠️  Not ready. Run: yarn svm:receiver-v2:setup"}`);
  }
}

new ReceiverV2StatusCommand().run().catch(() => process.exit(1));
