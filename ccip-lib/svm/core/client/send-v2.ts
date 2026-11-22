import {
  AccountMeta,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { Logger } from "../../utils/logger";
import { CCIPSendRequest, FinalityRequest } from "../models";

/**
 * CCIP 2.0 send path for Solana routers.
 *
 * A 2.0 router keeps the 1.6 `ccip_send` entrypoint, but lanes configured for 2.0 live under a
 * different PDA (`dest_chain_state_v2`) and must go through `ccip_send_v2`. Its account list is
 * not derived off-chain: the router exposes a staged `resolve_accounts_*` protocol that is
 * simulated round by round until it returns the full account list and resolution metadata.
 */

/** The router runs on a custom heap: resolution and the final instructions need the max frame. */
export const MAX_HEAP_FRAME_BYTES = 256 * 1024;
const MAX_RESOLUTION_ROUNDS = 64;

/** bytes4(keccak256("CCIP EVMExtraArgsV2")) */
const EVM_EXTRA_ARGS_V2_TAG = Buffer.from("181dcf10", "hex");
/** bytes4(keccak256("CCIP GenericExtraArgsV3")) */
export const GENERIC_EXTRA_ARGS_V3_TAG = Buffer.from("a69dd4aa", "hex");
const MAX_UINT32 = BigInt(0xffffffff);

/** Message fields shared by `ccip_send_v2` and `get_fee_v2` (`SVM2AnyMessage`). */
export type SVM2AnyMessageV2 = Pick<
  CCIPSendRequest,
  "receiver" | "data" | "tokenAmounts" | "feeToken"
>;

function anchorDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

const DISCRIMINATORS = {
  resolveAccountsStart: anchorDiscriminator("resolve_accounts_start"),
  ccipSendV2: anchorDiscriminator("ccip_send_v2"),
  getFeeV2: anchorDiscriminator("get_fee_v2"),
};

const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const u64 = (n: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
};
const borshBytes = (b: Buffer) => Buffer.concat([u32(b.length), b]);

/** Finds the CCIP 2.0 dest chain state PDA of a router. */
export function findDestChainStateV2PDA(
  chainSelector: bigint,
  routerProgramId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dest_chain_state_v2"), u64(chainSelector)],
    routerProgramId
  );
}

/** Whether the router has a CCIP 2.0 lane configured to the destination chain. */
export async function hasDestChainV2(
  connection: Connection,
  routerProgramId: PublicKey,
  destChainSelector: bigint
): Promise<boolean> {
  const [pda] = findDestChainStateV2PDA(destChainSelector, routerProgramId);
  const info = await connection.getAccountInfo(pda);
  return !!info && info.owner.equals(routerProgramId);
}

/**
 * Converts extraArgs to the GenericExtraArgsV3 that 2.0 lanes require.
 *
 * V3 args pass through. EVMExtraArgsV2 only carries its gas limit over, with every other field left
 * to the lane defaults (finality, CCVs, executor); `allowOutOfOrderExecution` is dropped, as 2.0
 * has no ordered execution.
 *
 * @returns The V3 args, or undefined if they can't be expressed as V3 (making the message 1.6-only)
 */
export function toGenericExtraArgsV3(extraArgs: Buffer): Buffer | undefined {
  const tag = extraArgs.subarray(0, 4);
  if (tag.equals(GENERIC_EXTRA_ARGS_V3_TAG)) return extraArgs;
  if (!tag.equals(EVM_EXTRA_ARGS_V2_TAG) || extraArgs.length < 4 + 16) {
    return undefined;
  }

  const gasLimit =
    extraArgs.readBigUInt64LE(4) + (extraArgs.readBigUInt64LE(12) << BigInt(64));
  if (gasLimit > MAX_UINT32) return undefined;

  return encodeGenericExtraArgsV3({ gasLimit: Number(gasLimit) });
}

/** Finality flag requesting the source chain's `safe` block tag (FinalityConfig.flags bit 0). */
export const FINALITY_SAFE_FLAG = 0x0001;
const MAX_FINALITY_BLOCK_DEPTH = 0xffff;

/**
 * Encodes a finality request into the on-chain FinalityConfig wire value
 * (flags u16 || block_depth u16, both little-endian Borsh).
 *
 * - "finalized" (or 0) → 0/0 (wait for full finality)
 * - "safe" → flags = FINALITY_SAFE_FLAG, depth 0
 * - N (1-65535) → block_depth = N (Faster-Than-Finality)
 */
export function encodeFinalityConfig(finality: FinalityRequest): {
  flags: number;
  blockDepth: number;
} {
  if (finality === "finalized") return { flags: 0, blockDepth: 0 };
  if (finality === "safe") return { flags: FINALITY_SAFE_FLAG, blockDepth: 0 };
  if (
    !Number.isInteger(finality) ||
    finality < 0 ||
    finality > MAX_FINALITY_BLOCK_DEPTH
  ) {
    throw new Error(
      `Invalid finality block depth: ${finality} (expected an integer 0-${MAX_FINALITY_BLOCK_DEPTH})`
    );
  }
  return { flags: 0, blockDepth: finality };
}

/**
 * Encodes GenericExtraArgsV3 (Borsh, little-endian) for a message from Solana.
 *
 * Layout (ccip-common `GenericExtraArgsV3`):
 *   tag(4) | gas_limit u32 | finality {flags u16, block_depth u16} | ccvs Vec<Pubkey> |
 *   ccv_args Vec<Vec<u8>> | executor Pubkey (zero = lane default) | executor_args Vec<u8> |
 *   token_receiver Vec<u8> | token_args Vec<u8>
 *
 * CCVs, executor and token fields are left empty so the lane defaults are used; only the
 * gas limit and the requested finality are carried.
 */
export function encodeGenericExtraArgsV3(options: {
  gasLimit?: number;
  finality?: FinalityRequest;
}): Buffer {
  const gasLimit = options.gasLimit ?? 0;
  if (!Number.isInteger(gasLimit) || gasLimit < 0 || gasLimit > MAX_UINT32) {
    throw new Error(
      `Invalid gas limit: ${gasLimit} (expected an integer 0-${MAX_UINT32})`
    );
  }
  const { flags, blockDepth } = encodeFinalityConfig(
    options.finality ?? "finalized"
  );

  return Buffer.concat([
    GENERIC_EXTRA_ARGS_V3_TAG,
    u32(gasLimit),
    u16(flags),
    u16(blockDepth),
    u32(0), // ccvs: empty → lane defaults
    u32(0), // ccv_args: empty
    Buffer.alloc(32), // executor: zero → lane default
    borshBytes(Buffer.alloc(0)), // executor_args
    borshBytes(Buffer.alloc(0)), // token_receiver
    borshBytes(Buffer.alloc(0)), // token_args
  ]);
}

/** Borsh-encodes `CcipSendV2Params` / `GetFeeParams` (same layout). */
function encodeSendParams(
  destChainSelector: bigint,
  message: SVM2AnyMessageV2,
  extraArgs: Buffer,
  resolutionMetadata: Buffer
): Buffer {
  const tokenAmounts = message.tokenAmounts.map((ta) =>
    Buffer.concat([ta.token.toBuffer(), u64(BigInt(ta.amount.toString()))])
  );
  return Buffer.concat([
    u64(destChainSelector),
    borshBytes(Buffer.from(message.receiver)),
    borshBytes(Buffer.from(message.data)),
    u32(tokenAmounts.length),
    ...tokenAmounts,
    message.feeToken.toBuffer(),
    borshBytes(extraArgs),
    borshBytes(resolutionMetadata),
  ]);
}

interface ResolveAccountsResponse {
  askAgainWith: PublicKey[];
  accountsToSave: AccountMeta[];
  lookupTablesToSave: PublicKey[];
  nextIxDiscriminator: Buffer | null;
  metadata: Buffer;
}

function decodeResolveAccountsResponse(data: Buffer): ResolveAccountsResponse {
  let offset = 0;
  const readU32 = () => {
    const v = data.readUInt32LE(offset);
    offset += 4;
    return v;
  };
  const readPubkey = () => {
    const pk = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    return pk;
  };
  const askAgainWith = Array.from({ length: readU32() }, readPubkey);
  const accountsToSave = Array.from({ length: readU32() }, () => {
    const pubkey = readPubkey();
    const isSigner = data[offset++] === 1;
    const isWritable = data[offset++] === 1;
    return { pubkey, isSigner, isWritable };
  });
  const lookupTablesToSave = Array.from({ length: readU32() }, readPubkey);
  let nextIxDiscriminator: Buffer | null = null;
  if (data[offset++] === 1) {
    nextIxDiscriminator = Buffer.from(data.subarray(offset, offset + 8));
    offset += 8;
  }
  const metadataLength = readU32();
  const metadata = Buffer.from(data.subarray(offset, offset + metadataLength));
  return {
    askAgainWith,
    accountsToSave,
    lookupTablesToSave,
    nextIxDiscriminator,
    metadata,
  };
}

async function simulate(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[],
  lookupTables: AddressLookupTableAccount[] = []
) {
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTables);
  const { value } = await connection.simulateTransaction(
    new VersionedTransaction(message),
    { sigVerify: false, replaceRecentBlockhash: true }
  );
  return value;
}

export function requestHeapFrameInstruction(): TransactionInstruction {
  return ComputeBudgetProgram.requestHeapFrame({ bytes: MAX_HEAP_FRAME_BYTES });
}

export interface ResolvedInstructionV2 {
  instruction: TransactionInstruction;
  lookupTables: AddressLookupTableAccount[];
}

/**
 * Resolves a CCIP 2.0 router instruction by simulating the router's resolution stages until it
 * reports completion, then builds the final instruction with the accumulated accounts (positional,
 * not deduplicated) and the last stage's metadata.
 */
async function resolveRouterInstructionV2(
  connection: Connection,
  routerProgramId: PublicKey,
  caller: PublicKey,
  discriminator: Buffer,
  encodeArgs: (resolutionMetadata: Buffer) => Buffer,
  logger: Logger
): Promise<ResolvedInstructionV2> {
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    routerProgramId
  );
  const ixData = Buffer.concat([discriminator, encodeArgs(Buffer.alloc(0))]);

  const accounts: AccountMeta[] = [];
  const lookupTableKeys: PublicKey[] = [];
  let stage = DISCRIMINATORS.resolveAccountsStart;
  let askWith: PublicKey[] = [config];
  let metadata = Buffer.alloc(0);

  for (let round = 1; ; round++) {
    if (round > MAX_RESOLUTION_ROUNDS) {
      throw new Error(
        `CCIP 2.0 account resolution did not complete within ${MAX_RESOLUTION_ROUNDS} rounds`
      );
    }

    const stageIx = new TransactionInstruction({
      programId: routerProgramId,
      keys: askWith.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: false,
      })),
      data: Buffer.concat([
        stage,
        caller.toBuffer(),
        borshBytes(ixData),
        borshBytes(metadata),
      ]),
    });
    const result = await simulate(connection, caller, [
      requestHeapFrameInstruction(),
      stageIx,
    ]);
    if (result.err) {
      logger.error("CCIP 2.0 account resolution stage logs:", result.logs);
      throw new Error(
        `CCIP 2.0 account resolution failed at round ${round} (stage 0x${stage.toString(
          "hex"
        )}): ${JSON.stringify(result.err)}`
      );
    }
    const returnData = result.returnData;
    if (!returnData?.data[0] || returnData.programId !== routerProgramId.toBase58()) {
      throw new Error(
        `CCIP 2.0 account resolution round ${round} returned no router return data`
      );
    }

    const response = decodeResolveAccountsResponse(
      Buffer.from(returnData.data[0], "base64")
    );
    logger.debug(
      `Resolution round ${round}: +${response.accountsToSave.length} accounts, +${response.lookupTablesToSave.length} lookup tables`
    );
    accounts.push(...response.accountsToSave);
    lookupTableKeys.push(...response.lookupTablesToSave);
    metadata = response.metadata;
    if (!response.nextIxDiscriminator) break;
    stage = response.nextIxDiscriminator;
    askWith = response.askAgainWith;
  }

  const uniqueTables = [
    ...new Map(lookupTableKeys.map((k) => [k.toBase58(), k])).values(),
  ];
  const lookupTables = await Promise.all(
    uniqueTables.map(async (key) => {
      const { value } = await connection.getAddressLookupTable(key);
      if (!value) throw new Error(`Lookup table ${key.toBase58()} not found`);
      return value;
    })
  );

  return {
    instruction: new TransactionInstruction({
      programId: routerProgramId,
      keys: accounts,
      data: Buffer.concat([discriminator, encodeArgs(metadata)]),
    }),
    lookupTables,
  };
}

/** Resolves the router's `ccip_send_v2` instruction for a message signed by `sender`. */
export function resolveCcipSendV2(
  connection: Connection,
  routerProgramId: PublicKey,
  sender: PublicKey,
  destChainSelector: bigint,
  message: SVM2AnyMessageV2,
  extraArgsV3: Buffer,
  logger: Logger
): Promise<ResolvedInstructionV2> {
  return resolveRouterInstructionV2(
    connection,
    routerProgramId,
    sender,
    DISCRIMINATORS.ccipSendV2,
    (md) => encodeSendParams(destChainSelector, message, extraArgsV3, md),
    logger
  );
}

/**
 * Quotes a message over a CCIP 2.0 lane by simulating the resolved `get_fee_v2`.
 * @param payer Existing account used as simulation fee payer; it never signs
 * @returns Fee amount and the token it's denominated in
 */
export async function getFeeV2(
  connection: Connection,
  routerProgramId: PublicKey,
  payer: PublicKey,
  destChainSelector: bigint,
  message: SVM2AnyMessageV2,
  extraArgsV3: Buffer,
  logger: Logger
): Promise<{ amount: bigint; token: PublicKey }> {
  const { instruction, lookupTables } = await resolveRouterInstructionV2(
    connection,
    routerProgramId,
    payer,
    DISCRIMINATORS.getFeeV2,
    (md) => encodeSendParams(destChainSelector, message, extraArgsV3, md),
    logger
  );
  const result = await simulate(
    connection,
    payer,
    [requestHeapFrameInstruction(), instruction],
    lookupTables
  );
  if (result.err) {
    logger.error("get_fee_v2 simulation logs:", result.logs);
    throw new Error(`get_fee_v2 simulation failed: ${JSON.stringify(result.err)}`);
  }
  const returnData = result.returnData;
  if (!returnData?.data[0] || returnData.programId !== routerProgramId.toBase58()) {
    throw new Error("No router return data from get_fee_v2 simulation");
  }
  const data = Buffer.from(returnData.data[0], "base64");
  return {
    amount: data.readBigUInt64LE(0),
    token: new PublicKey(data.subarray(8, 40)),
  };
}
