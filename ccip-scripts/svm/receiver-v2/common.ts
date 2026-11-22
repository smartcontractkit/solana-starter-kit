import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { SVMChainConfig } from "../../config";

export const BPF_UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
export const FINALITY_FLAG_SAFE = 0x0001;
export const RECEIVER_VERSION_V2 = 2;

export function resolveReceiverV2ProgramId(config: SVMChainConfig, override?: string): PublicKey {
  const id = override || config.receiverV2ProgramId?.toBase58();
  if (!id) throw new Error("No receiver v2 program ID. Pass --program-id or set receiverV2ProgramId in config");
  return new PublicKey(id);
}

export function loadReceiverV2Program(wallet: Keypair, config: SVMChainConfig, programId: PublicKey): anchor.Program {
  const idlPath = path.join(__dirname, "../../../target/idl/ccip_receiver_v2.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Build with 'anchor build -p ccip_receiver_v2'`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  idl.address = programId.toBase58();
  const provider = new anchor.AnchorProvider(config.connection, new anchor.Wallet(wallet), {
    commitment: "confirmed",
  });
  return new anchor.Program(idl, provider);
}

export function selectorLe(selector: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(selector);
  return buf;
}

export function deriveReceiverV2Pdas(programId: PublicKey, router: PublicKey, sourceChainSelector: bigint) {
  const find = (seeds: Buffer[], owner: PublicKey) => PublicKey.findProgramAddressSync(seeds, owner)[0];
  return {
    state: find([Buffer.from("state")], programId),
    messagesStorage: find([Buffer.from("messages_storage")], programId),
    ccvConfig: find([Buffer.from("ccv_config"), selectorLe(sourceChainSelector)], programId),
    registrationSigner: find([Buffer.from("ccip_receiver_registration"), router.toBuffer()], programId),
    receiverRegistry: find([Buffer.from("receiver_registry"), programId.toBuffer()], router),
    routerConfig: find([Buffer.from("config")], router),
    routerEventAuthority: find([Buffer.from("__event_authority")], router),
  };
}

/**
 * Router ReceiverRegistry (ccip_common::router_accounts):
 * [8 discriminator][u8 bump][u8 version][32 receiver_program][u8 receiver_version]
 */
export function parseReceiverRegistry(
  data: Buffer | null | undefined
): { receiverProgram: PublicKey; receiverVersion: number } | undefined {
  if (!data || data.length < 43) return undefined;
  return {
    receiverProgram: new PublicKey(data.subarray(10, 42)),
    receiverVersion: data[42],
  };
}

export function describeFinalityConfig(flags: number, blockDepth: number): string {
  const parts: string[] = [];
  if (flags & FINALITY_FLAG_SAFE) parts.push("`safe` tag");
  if (blockDepth > 0) parts.push(`>= ${blockDepth} block(s)`);
  return parts.length ? `finalized, or ${parts.join(", or ")}` : "finalized only";
}
