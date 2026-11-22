/**
 * GenericExtraArgsV3 (tag 0xa69dd4aa) helpers for the ccip-sender-v2 chain config.
 *
 * The stored extraArgs bytes are parsed by the Solana router with **Borsh**
 * (`GenericExtraArgsV3::deserialize` in ccip-router's `parse_extra_args_with_defaults`):
 * LE u32 gas limit, `{flags: u16, block_depth: u16}` finality, u32-length-prefixed
 * vecs, and a fixed 32-byte executor pubkey. The SDK's EVM-packed codec
 * (`EVMChain.encodeExtraArgs`: BE u32s, u8/u16 lengths) shares the same tag but a
 * different layout — bytes written with it are rejected on-chain. Always use
 * `encodeSolanaGenericExtraArgsV3` (Borsh) here.
 */
import { type GenericExtraArgsV3 } from '@chainlink/ccip-sdk'
// Register every chain family: decodeSolanaGenericExtraArgsV3 needs SVM registered to
// decode addresses, and a bare dist import (as here) does not trigger the root index's
// registration side effects.
import '@chainlink/ccip-sdk/all'

import {
  decodeSolanaGenericExtraArgsV3,
  encodeSolanaGenericExtraArgsV3,
} from '@chainlink/ccip-sdk/dist/solana/extra-args.js'

/** Default extraArgs the sender program stores: lane-default CCVs/executor, finalized. */
export function defaultSenderExtraArgs(gasLimit: bigint, finality: GenericExtraArgsV3['finality']): GenericExtraArgsV3 {
  return {
    gasLimit,
    finality,
    ccvs: [],
    ccvArgs: [],
    executor: '',
    executorArgs: '0x',
    tokenReceiver: '',
    tokenArgs: '0x',
  }
}

/** Borsh-encode GenericExtraArgsV3 for the sender program's chain config. */
export function encodeSenderExtraArgs(args: GenericExtraArgsV3): Buffer {
  return Buffer.from(encodeSolanaGenericExtraArgsV3(args).slice(2), 'hex')
}

/**
 * Decode the sender program's stored extraArgs (Borsh GenericExtraArgsV3).
 * Empty bytes mean the lane defaults (gas limit 0, finalized).
 *
 * Falls back to the legacy EVM-packed encoding (BE u32s, u8/u16 lengths) that
 * earlier setup/update scripts wrote by mistake, so one update run migrates it.
 * The fallback only accepts buffers of the legacy shape (19 bytes for defaults,
 * 4 + 15 + variable) — a Borsh buffer must never be misread as big-endian.
 */
export function decodeSenderExtraArgs(bytes: Uint8Array): GenericExtraArgsV3 {
  if (!bytes.length) return defaultSenderExtraArgs(0n, 'finalized')
  try {
    return decodeSolanaGenericExtraArgsV3(bytes)
  } catch (err) {
    try {
      return decodeLegacyEvmPackedExtraArgs(bytes)
    } catch {
      throw err
    }
  }
}

/** Decode the legacy EVM-packed GenericExtraArgsV3 (same tag, BE integers, u8/u16 lengths). */
function decodeLegacyEvmPackedExtraArgs(bytes: Uint8Array): GenericExtraArgsV3 {
  const buf = Buffer.from(bytes)
  if (buf.subarray(0, 4).toString('hex') !== 'a69dd4aa') throw new Error('not GenericExtraArgsV3')
  // The legacy encoding is tightly packed: 4 tag + 4 gas + 4 finality + 1 ccvCount + per-ccv
  // (1 len + addr + 2 argsLen + args) + 1 executorLen + executor + 2 executorArgsLen + args +
  // 1 tokenReceiverLen + receiver + 2 tokenArgsLen + args. A Borsh buffer (u32 lengths, fixed
  // 32-byte executor) is at least 64 bytes and never parses as this shape — reject it instead
  // of returning garbage.
  let offset = 4
  const gasLimit = BigInt(buf.readUInt32BE(offset))
  offset += 4
  const finalityCode = buf.readUInt32BE(offset)
  offset += 4
  const ccvCount = buf.readUInt8(offset)
  offset += 1
  const ccvs: string[] = []
  const ccvArgs: string[] = []
  for (let i = 0; i < ccvCount; i++) {
    const addrLen = buf.readUInt8(offset)
    offset += 1
    const addr = '0x' + buf.subarray(offset, offset + addrLen).toString('hex')
    offset += addrLen
    const argsLen = buf.readUInt16BE(offset)
    offset += 2
    ccvArgs.push('0x' + buf.subarray(offset, offset + argsLen).toString('hex'))
    offset += argsLen
    ccvs.push(addrLen ? addr : '')
  }
  const executorLen = buf.readUInt8(offset)
  offset += 1
  const executor = executorLen ? '0x' + buf.subarray(offset, offset + executorLen).toString('hex') : ''
  offset += executorLen
  const executorArgsLen = buf.readUInt16BE(offset)
  offset += 2
  const executorArgs = '0x' + buf.subarray(offset, offset + executorArgsLen).toString('hex')
  offset += executorArgsLen
  const tokenReceiverLen = buf.readUInt8(offset)
  offset += 1
  const tokenReceiver = tokenReceiverLen ? '0x' + buf.subarray(offset, offset + tokenReceiverLen).toString('hex') : ''
  offset += tokenReceiverLen
  const tokenArgsLen = buf.readUInt16BE(offset)
  offset += 2
  const tokenArgs = '0x' + buf.subarray(offset, offset + tokenArgsLen).toString('hex')
  offset += tokenArgsLen
  if (offset !== buf.length) throw new Error(`legacy EVM-packed length mismatch: consumed ${offset} of ${buf.length}`)
  const finality: GenericExtraArgsV3['finality'] =
    finalityCode & 0x00010000 ? 'safe' : finalityCode & 0xffff || 'finalized'
  return { gasLimit, finality, ccvs, ccvArgs, executor, executorArgs, tokenReceiver, tokenArgs }
}

/**
 * Normalize decoded extraArgs into a clean GenericExtraArgsV3 for the SDK quote
 * path (`buildMessageForDest`): the decoder returns the zero pubkey for an empty
 * executor and `'0x'` for an empty tokenReceiver, which the base-class validation
 * would turn into a real 20-byte zero token receiver (router: TokenReceiverNotAllowed).
 */
export function normalizeDecodedExtraArgs(args: GenericExtraArgsV3 & { _tag?: string }): GenericExtraArgsV3 {
  const ZERO_PUBKEY = '11111111111111111111111111111111'
  return {
    gasLimit: args.gasLimit,
    finality: args.finality,
    ccvs: args.ccvs,
    ccvArgs: args.ccvArgs,
    executor: !args.executor || args.executor === ZERO_PUBKEY ? '' : args.executor,
    executorArgs: args.executorArgs,
    tokenReceiver: !args.tokenReceiver || args.tokenReceiver === '0x' ? '' : args.tokenReceiver,
    tokenArgs: args.tokenArgs,
  }
}
