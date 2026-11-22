/**
 * Send a CCIP 2.0 message through the deployed ccip-sender-v2 program instead of
 * calling the router directly.
 *
 * The program wraps the router's `ccip_send_v2`: the caller signs the program's
 * `ccip_send` instruction, which pulls the caller's tokens/fees, then CPIs the
 * router with the receiver and extra args from its stored chain config
 * (`svm:sender-v2:setup`).
 *
 * Its account list is produced by the program's own staged resolver
 * (`resolve_accounts_start` → `forward_router_stage` rounds), which wraps the
 * router's. This module drives those stages (the SDK's generic driver assumes
 * the router's `["config"]` PDA; this program's first account is its `["state"]`
 * PDA), then builds and sends the final instruction.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BN, BorshCoder, type Idl } from '@coral-xyz/anchor'
import {
  type AccountMeta,
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  type Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { getBytes, hexlify } from 'ethers'

import type { CCIPRequest, FinalityRequested } from '@chainlink/ccip-sdk'

import {
  createApproveCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  MintLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

import {
  decodeResolveAccountsResponse,
  encodeResolveAccountsIx,
  MAX_HEAP_FRAME_BYTES,
} from '@chainlink/ccip-sdk/dist/solana/resolution.js'
import { fetchLookupTables } from '@chainlink/ccip-sdk/dist/solana/resolution.js'
import { simulateAndSendTxs } from '@chainlink/ccip-sdk/dist/solana/utils.js'
import { sighash } from '@chainlink/ccip-sdk/dist/solana/coder.js'

import { DEFAULTS, SOLANA_DEVNET, SVM_NO_EXECUTION_PUBKEY } from './config.ts'
import { QUIET_SDK_LOGGER, getSolanaChain, toSdkWallet } from './chains.ts'
import { decodeSenderExtraArgs, encodeSenderExtraArgs, normalizeDecodedExtraArgs } from './extra-args.ts'
import { ccipSenderPda, remoteChainConfigPda, senderStatePda } from './pdas.ts'

/** Wrapped SOL mint: what the router normalizes the zero fee token to. */
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')

const here = dirname(fileURLToPath(import.meta.url))
const SENDER_IDL = JSON.parse(
  readFileSync(join(here, '..', '..', 'target', 'idl', 'ccip_sender_v2.json'), 'utf-8'),
) as Idl

/** Coder for the sender IDL (Anchor 0.31 format, so the repo's own Anchor), with
 * the SDK's growing-buffer encode: Anchor's default 1000B buffer overflows on
 * larger params and its retry loop OOMs (see the SDK's sizedCoder). */
const senderCoder = new BorshCoder(SENDER_IDL)
{
  const { typeLayouts } = senderCoder.types as unknown as {
    typeLayouts: Map<string, { encode: (value: unknown, buffer: Buffer) => number }>
  }
  Object.assign(senderCoder.types, {
    encode(name: string, value: unknown): Buffer {
      const layout = typeLayouts.get(name)
      if (!layout) throw new Error(`Unknown IDL type: ${name}`)
      for (let size = 512; ; size *= 8) {
        const buffer = Buffer.alloc(size)
        try {
          return buffer.subarray(0, layout.encode(value, buffer))
        } catch (err) {
          if (!(err instanceof RangeError) || size >= 1 << 20) throw err
        }
      }
    },
  })
}

/** Discriminators of the sender program's instructions we drive or build. */
const CCIP_SEND_DISCRIMINATOR = sighash('global', 'ccip_send')
const RESOLVE_START_DISCRIMINATOR = sighash('global', 'resolve_accounts_start')
const UPDATE_CHAIN_CONFIG_DISCRIMINATOR = sighash('global', 'update_chain_config')

/** The sender program's `ccip_send` params, mirroring `CcipSendParams` on-chain. */
export interface SenderCcipSendParams {
  destChainSelector: bigint
  tokenAmount: { token: PublicKey; amount: bigint } | null
  data: Buffer
  /** `PublicKey.default` pays fees in native SOL. */
  feeToken: PublicKey
  maxFee: bigint
  resolutionMetadata: Buffer
}

/** A resolved `ccip_send`: the instruction plus the lookup tables it needs. */
export interface ResolvedSenderSend {
  instruction: TransactionInstruction
  lookupTables: AddressLookupTableAccount[]
}

/** Encode `CcipSendParams` (snake_case, as the on-chain struct serializes). */
function encodeSendParams(params: SenderCcipSendParams): Buffer {
  return senderCoder.types.encode('CcipSendParams', {
    dest_chain_selector: new BN(params.destChainSelector.toString()),
    token_amount: params.tokenAmount
      ? { token: params.tokenAmount.token, amount: new BN(params.tokenAmount.amount.toString()) }
      : null,
    data: params.data,
    fee_token: params.feeToken,
    max_fee: new BN(params.maxFee.toString()),
    resolution_metadata: params.resolutionMetadata,
  })
}

/**
 * Drive the sender program's staged account resolution to completion.
 * Mirrors the SDK's `resolveAccounts`, but with this program's `["state"]` PDA
 * (plus its extra start-stage accounts) in place of the router's `["config"]`.
 */
export async function resolveSenderAccounts(
  { connection, logger }: { connection: Connection; logger?: unknown },
  {
    senderProgramId,
    caller,
    destChainSelector,
    params,
  }: {
    senderProgramId: PublicKey
    caller: PublicKey
    destChainSelector: bigint
    /** Params with `resolutionMetadata` empty — resolution produces it.
     * `maxFee` may be any placeholder; it does not affect the account list. */
    params: Omit<SenderCcipSendParams, 'resolutionMetadata'>
  },
): Promise<{ accounts: AccountMeta[]; lookupTables: PublicKey[]; metadata: Buffer; rounds: number }> {
  const routerProgramId = new PublicKey(SOLANA_DEVNET.router)
  const state = senderStatePda(senderProgramId)
  const chainConfig = remoteChainConfigPda(senderProgramId, destChainSelector)
  const routerConfig = PublicKey.findProgramAddressSync([Buffer.from('config')], routerProgramId)[0]

  const ixData = Buffer.concat([
    CCIP_SEND_DISCRIMINATOR,
    encodeSendParams({ ...params, resolutionMetadata: Buffer.alloc(0) }),
  ])

  const accounts: AccountMeta[] = []
  const lookupTables: PublicKey[] = []
  let discriminator: Buffer = RESOLVE_START_DISCRIMINATOR
  // start stage: state PDA first, then the program's extra accounts, then the
  // transferred token's mint (only when the message carries a transfer)
  let askWith: readonly PublicKey[] = [
    state,
    chainConfig,
    params.feeToken.equals(PublicKey.default) ? WSOL_MINT : params.feeToken,
    routerProgramId,
    routerConfig,
    ...(params.tokenAmount ? [params.tokenAmount.token] : []),
  ]
  let metadata = Buffer.alloc(0)

  for (let round = 1; ; round++) {
    const ix = encodeResolveAccountsIx(senderProgramId, discriminator, { caller, ixData, metadata }, askWith)
    // raw RPC simulate (the SDK's wrapper OOMs on this program's large return data)
    const msg = new TransactionMessage({
      payerKey: caller,
      recentBlockhash: '11111111111111111111111111111112',
      instructions: [ComputeBudgetProgram.requestHeapFrame({ bytes: MAX_HEAP_FRAME_BYTES }), ix],
    }).compileToV0Message()
    const sim = await connection.simulateTransaction(new VersionedTransaction(msg), {
      sigVerify: false,
      replaceRecentBlockhash: true,
    })
    if (sim.value.err) {
      throw new Error(
        `Sender resolution round ${round} failed: ${JSON.stringify(sim.value.err)}\n${(sim.value.logs ?? []).slice(-6).join('\n')}`,
      )
    }
    const returnData = sim.value.returnData
    if (!returnData?.data[0] || returnData.programId !== senderProgramId.toBase58()) {
      throw new Error(`No return data from sender resolution round ${round} (${returnData?.programId ?? 'none'})`)
    }
    const response = decodeResolveAccountsResponse(Buffer.from(returnData.data[0], returnData.data[1] as never))
    accounts.push(...response.accountsToSave)
    lookupTables.push(...response.lookupTablesToSave)
    metadata = response.metadata
    if (!response.nextIxDiscriminator) return { accounts, lookupTables, metadata, rounds: round }
    discriminator = response.nextIxDiscriminator
    askWith = response.askAgainWith
  }
}

/**
 * Resolve and build the sender program's `ccip_send` instruction for a message.
 */
export async function buildSenderSend(opts: {
  connection: Connection
  logger?: unknown
  senderProgramId: PublicKey
  caller: PublicKey
  destChainSelector: bigint
  params: Omit<SenderCcipSendParams, 'resolutionMetadata'>
}): Promise<ResolvedSenderSend> {
  const resolved = await resolveSenderAccounts(opts, opts)
  const instruction = new TransactionInstruction({
    programId: opts.senderProgramId,
    keys: resolved.accounts,
    data: Buffer.concat([
      CCIP_SEND_DISCRIMINATOR,
      encodeSendParams({ ...opts.params, resolutionMetadata: resolved.metadata }),
    ]),
  })
  const lookupTables = await fetchLookupTables(opts.connection, resolved.lookupTables)
  return { instruction, lookupTables }
}

/**
 * Send the resolved `ccip_send` instruction, signed by `signer`, and return the
 * transaction hash. Uses the SDK's send path (simulate → size compute → send,
 * splitting if the tx is too large), with the 256kB heap frame the program needs.
 *
 * `preInstructions` (e.g. the `ccip_sender` PDA's token-account creation) are
 * prepended before the heap frame request; they are part of the same atomic tx.
 */
export async function sendSenderSend(opts: {
  connection: Connection
  logger?: unknown
  signer: { publicKey: PublicKey; signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction> }
  send: ResolvedSenderSend
  computeUnits?: number
  preInstructions?: TransactionInstruction[]
}): Promise<string> {
  const { hash } = await simulateAndSendTxs(
    { connection: opts.connection, logger: (opts.logger ?? QUIET_SDK_LOGGER) as never },
    opts.signer as never,
    {
      instructions: [
        ...(opts.preInstructions ?? []),
        ComputeBudgetProgram.requestHeapFrame({ bytes: MAX_HEAP_FRAME_BYTES }),
        opts.send.instruction,
      ],
      mainIndex: (opts.preInstructions?.length ?? 0) + 1,
      lookupTables: opts.send.lookupTables,
    },
    { computeUnits: opts.computeUnits, split: 'resource' },
  )
  return hash
}

/**
 * High-level program-routed send: quote the fee off-chain (the program requires
 * `max_fee` up front), resolve the program's account list, send its `ccip_send`
 * instruction, and return the sent CCIP request (the router's
 * `CCIPMessageSentV2` event is emitted through the program's CPI, so the usual
 * `getMessagesInTx` finds it).
 *
 * The receiver and extra args (gas limit, finality, executor) default to the program's
 * stored chain config for the destination; `configOverrides` replaces them for a single
 * send (an `update_chain_config` transaction is confirmed first when they differ).
 */
export async function sendViaSenderProgram(opts: {
  senderProgramId: string
  /** Solana keypair paying the fee (and signing the program's instruction). */
  caller: Keypair
  destChainSelector: bigint
  params: {
    data: Buffer
    /** Token transfer (mint + base-unit amount), or null for data-only. */
    tokenAmount: { token: string; amount: bigint } | null
    /** Fee token mint, or null for native SOL. */
    feeToken: string | null
  }
  /** Multiplier on the quoted fee for `max_fee` headroom (default 1.2). */
  feeSlippage?: number
  /**
   * Per-send overrides for the program's stored chain config. Any field set here is
   * written on-chain via an `update_chain_config` transaction confirmed before the send,
   * so the program's `ccip_send` reads the updated values — no separate setup/config
   * call needed. Unset fields keep their stored values; an update requires the caller
   * to be the program's owner.
   */
  configOverrides?: {
    recipient?: string
    gasLimit?: number
    finality?: FinalityRequested
    /** Skip automated destination execution (SVM no-execution sentinel executor). */
    noExec?: boolean
  }
}): Promise<CCIPRequest> {
  const { senderProgramId, caller, destChainSelector, params } = opts
  const programId = new PublicKey(senderProgramId)
  const chain = await getSolanaChain()
  const connection = chain['connection'] as Connection

  // 1. Quote: the same message the program will send (receiver/extraArgs from its chain config).
  const chainConfigAccount = await connection.getAccountInfo(remoteChainConfigPda(programId, destChainSelector))
  if (!chainConfigAccount) {
    throw new Error(
      `No chain config for selector ${destChainSelector} on ${senderProgramId}: run "npm run svm:sender-v2:setup" first`,
    )
  }
  // RemoteChainConfig: 8-byte Anchor discriminator, version u8, bump u8,
  // recipient Vec<u8> (u32 len + bytes), extra_args_bytes Vec<u8> (u32 len + bytes)
  const cfg = chainConfigAccount.data
  const recipientLen = cfg.readUInt32LE(10)
  let recipient = hexlify(cfg.subarray(14, 14 + recipientLen))
  const extraArgsOffset = 14 + recipientLen
  const extraArgsLen = cfg.readUInt32LE(extraArgsOffset)
  const extraArgsBytes = cfg.subarray(extraArgsOffset + 4, extraArgsOffset + 4 + extraArgsLen)

  // Decode the stored Borsh GenericExtraArgsV3 (tag a69dd4aa) to rebuild the message for the
  // quote; empty extra args mean the router applies its lane defaults (gas limit 0, default
  // CCVs/executor, finalized finality) — quote the same shape. The decoded zero-pubkey
  // executor / '0x' tokenReceiver are normalized back to empty so the SDK's
  // buildMessageForDest does not validate them into real addresses.
  const extraArgs = normalizeDecodedExtraArgs(decodeSenderExtraArgs(extraArgsBytes))

  // Apply per-send overrides: the program reads its chain config on-chain during ccip_send,
  // so overriding the client-side quote alone would not change the actual message. Instead,
  // an update_chain_config transaction is sent and confirmed before the quote below, and
  // the quote uses the same merged values so max_fee matches what will actually be sent.
  const ov = opts.configOverrides ?? {}
  if (ov.recipient !== undefined) recipient = hexlify(Buffer.from(ov.recipient.replace(/^0x/, ''), 'hex'))
  if (ov.gasLimit !== undefined) extraArgs.gasLimit = BigInt(ov.gasLimit)
  if (ov.finality !== undefined) extraArgs.finality = ov.finality
  // noExec is tri-state: undefined = keep stored executor; true = sentinel; false = restore
  // automated execution by clearing a persisted sentinel — a custom executor configured
  // on-chain is preserved.
  if (ov.noExec === true) extraArgs.executor = SVM_NO_EXECUTION_PUBKEY
  if (ov.noExec === false && extraArgs.executor === SVM_NO_EXECUTION_PUBKEY) extraArgs.executor = ''

  // Only prepend an update when the merged config actually differs from what is stored —
  // otherwise every program-routed send would needlessly rewrite (and re-pay rent for) the
  // config account. The stored bytes are the source of truth for the comparison.
  const mergedExtraArgsBytes = encodeSenderExtraArgs(extraArgs)
  const mergedRecipientBytes = Buffer.from(recipient.replace(/^0x/, ''), 'hex')
  const storedRecipientBytes = cfg.subarray(14, 14 + recipientLen)
  const needsConfigUpdate =
    !mergedExtraArgsBytes.equals(extraArgsBytes) || !mergedRecipientBytes.equals(storedRecipientBytes)

  // The prepended update_chain_config requires the caller to be the program's configured
  // owner (state.owner @ OnlyOwner on-chain). Fail fast with a clear message instead of the
  // raw Anchor error mid-transaction.
  if (needsConfigUpdate) {
    const stateAccount = await connection.getAccountInfo(senderStatePda(programId))
    if (!stateAccount) {
      throw new Error(`Sender program ${senderProgramId} is not initialized: run "npm run svm:sender-v2:setup" first`)
    }
    // BaseState: 8-byte Anchor discriminator, version u8, bump u8, owner Pubkey (32)
    const owner = new PublicKey(stateAccount.data.subarray(11, 43))
    if (!owner.equals(caller.publicKey)) {
      throw new Error(
        `Config overrides require the sender program's owner (${owner.toBase58()}), but the caller is ` +
          `${caller.publicKey.toBase58()}. Either run the send from the owner's wallet, or have the owner apply the ` +
          `config change first with "npm run svm:sender-v2:config", then send without the override flags.`,
      )
    }

    // Send update_chain_config as its OWN transaction and wait for confirmation BEFORE the
    // quote and account resolution. The account list depends on the config (the executor
    // field decides whether executor accounts are resolved at all), so the update and the
    // send cannot share a transaction — resolution would use the pre-update state while
    // ccip_send executes against the post-update one (MissingAccount when the executor changes).
    const updateIx = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: senderStatePda(programId), isSigner: false, isWritable: true },
        { pubkey: remoteChainConfigPda(programId, destChainSelector), isSigner: false, isWritable: true },
        { pubkey: caller.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        UPDATE_CHAIN_CONFIG_DISCRIMINATOR,
        senderCoder.types.encode('ChainConfigParams', {
          chain_selector: new BN(destChainSelector.toString()),
          recipient: Buffer.from(recipient.replace(/^0x/, ''), 'hex'),
          extra_args_bytes: encodeSenderExtraArgs(extraArgs),
        }),
      ]),
    })
    console.log('   Config override: updating chain config (separate tx)…')
    const updateHash = await sendSenderSend({
      connection,
      logger: QUIET_SDK_LOGGER,
      signer: toSdkWallet(caller),
      send: { instruction: updateIx, lookupTables: [] },
    })
    const latest = await connection.getLatestBlockhash()
    await connection.confirmTransaction({ signature: updateHash, ...latest }, DEFAULTS.solanaCommitment)
    console.log(`   Config updated:  ${SOLANA_DEVNET.txUrl(updateHash)}`)
  }

  const message = {
    receiver: recipient,
    data: params.data,
    ...(params.tokenAmount
      ? { tokenAmounts: [{ token: params.tokenAmount.token, amount: params.tokenAmount.amount }] }
      : {}),
    ...(params.feeToken ? { feeToken: params.feeToken } : {}),
    extraArgs,
  }
  const fee = await chain.getFee({
    router: SOLANA_DEVNET.router,
    destChainSelector,
    message,
  })
  const maxFee = BigInt(Math.ceil(Number(fee) * (opts.feeSlippage ?? 1.2)))
  console.log(`   Fee quote:       ${fee} lamports → max_fee ${maxFee} (program-routed send)`)

  // 2. Resolve the program's account list and build its ccip_send instruction.
  const send = await buildSenderSend({
    connection,
    logger: QUIET_SDK_LOGGER,
    senderProgramId: programId,
    caller: caller.publicKey,
    destChainSelector,
    params: {
      destChainSelector,
      tokenAmount: params.tokenAmount
        ? { token: new PublicKey(params.tokenAmount.token), amount: params.tokenAmount.amount }
        : null,
      data: params.data,
      feeToken: params.feeToken ? new PublicKey(params.feeToken) : PublicKey.default,
      maxFee,
    },
  })

  // 2b. The program moves tokens through the `ccip_sender` PDA's token accounts (transfer to
  // the PDA's ATA, then the router pulls from it), which must exist first. Create them
  // idempotently for whatever mints this send touches — the transferred token and, when
  // paying fees in a token, the fee token — so any registered token works with no setup.
  //
  // The transfer out of the caller's ATA is signed by the PDA, so the caller must also
  // delegate their ATA to it (approve_checked, amount = transfer + max_fee when the mints
  // match, else just the transfer). The program re-approves for the router itself; this
  // delegation is only for the caller → PDA hop.
  const ccipSender = ccipSenderPda(programId)
  const ataMints = new Set<PublicKey>(
    [
      params.tokenAmount ? new PublicKey(params.tokenAmount.token) : null,
      params.feeToken ? new PublicKey(params.feeToken) : null,
    ].filter((m): m is PublicKey => m != null),
  )
  const preInstructions: TransactionInstruction[] = []
  for (const mint of ataMints) {
    const mintAccount = await connection.getAccountInfo(mint)
    if (!mintAccount) throw new Error(`Token mint ${mint} not found`)
    const tokenProgram = mintAccount.owner
    if (!tokenProgram.equals(TOKEN_PROGRAM_ID) && !tokenProgram.equals(TOKEN_2022_PROGRAM_ID)) {
      throw new Error(`Mint ${mint} is not an SPL token (owner ${tokenProgram.toBase58()})`)
    }
    const pdaAta = getAssociatedTokenAddressSync(mint, ccipSender, true, tokenProgram)
    preInstructions.push(
      createAssociatedTokenAccountIdempotentInstruction(caller.publicKey, pdaAta, ccipSender, mint, tokenProgram),
    )
    if (params.tokenAmount && new PublicKey(params.tokenAmount.token).equals(mint)) {
      const callerAta = getAssociatedTokenAddressSync(mint, caller.publicKey, false, tokenProgram)
      const mintDecimals = MintLayout.decode(mintAccount.data).decimals
      const isFeeMint = params.feeToken != null && new PublicKey(params.feeToken).equals(mint)
      const delegated =
        params.tokenAmount && isFeeMint ? params.tokenAmount.amount + maxFee : params.tokenAmount!.amount
      preInstructions.push(
        createApproveCheckedInstruction(
          callerAta,
          mint,
          ccipSender,
          caller.publicKey,
          delegated,
          mintDecimals,
          [],
          tokenProgram,
        ),
      )
    } else if (params.feeToken != null && new PublicKey(params.feeToken).equals(mint)) {
      // Fee token distinct from the transferred token: the program pulls max_fee out of the
      // caller's fee ATA with the PDA signing, so delegate that much to it.
      const callerAta = getAssociatedTokenAddressSync(mint, caller.publicKey, false, tokenProgram)
      const mintDecimals = MintLayout.decode(mintAccount.data).decimals
      preInstructions.push(
        createApproveCheckedInstruction(
          callerAta,
          mint,
          ccipSender,
          caller.publicKey,
          maxFee,
          mintDecimals,
          [],
          tokenProgram,
        ),
      )
    }
  }

  // 3. Send it, then read the message back out of the tx logs.
  const hash = await sendSenderSend({
    connection,
    logger: QUIET_SDK_LOGGER,
    signer: toSdkWallet(caller),
    send,
    preInstructions,
  })
  const tx = await chain.getTransaction(hash)
  const request = (await chain.getMessagesInTx(tx))[0]!
  return request
}
