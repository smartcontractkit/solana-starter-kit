/**
 * PDA derivations for the CCIP programs, verified against the on-chain sources:
 * programs/ccip-receiver-v2/src/state.rs, programs/ccip-sender-v2/src/state.rs
 * and ccip-common (seed.rs / ccvs.rs) at contracts/v2.1.0.
 */
import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'

import { SOLANA_DEVNET } from './config.ts'

/** Solana's upgradeable-program loader; owns every program's ProgramData account. */
export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')

/** Encode a chain selector as the 8-byte little-endian seed used in PDA derivations. */
export function selectorLeBytes(selector: bigint): Buffer {
  return new BN(selector.toString()).toArrayLike(Buffer, 'le', 8)
}

/** ProgramData account of an upgradeable program (holds the upgrade authority). */
export function programDataPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_LOADER_UPGRADEABLE_PROGRAM_ID)[0]
}

/** The deployed ccip-receiver-v2 program (see config.ts). */
const RECEIVER_V2_PROGRAM_ID = SOLANA_DEVNET.receiverV2ProgramId

// --- ccip-receiver-v2 ---

export function receiverConfigPda(receiverProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('config')], receiverProgramId)[0]
}

export function registrationSignerPda(receiverProgramId: PublicKey, routerProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ccip_receiver_registration'), routerProgramId.toBuffer()],
    receiverProgramId,
  )[0]
}

/** Receiver registry entry, a PDA under the router program. */
export function receiverRegistryPda(receiverProgramId: PublicKey, routerProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('receiver_registry'), receiverProgramId.toBuffer()],
    routerProgramId,
  )[0]
}

export function ccvConfigPda(receiverProgramId: PublicKey, sourceChainSelector: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ccv_config'), selectorLeBytes(sourceChainSelector)],
    receiverProgramId,
  )[0]
}

export function approvedSenderPda(
  receiverProgramId: PublicKey,
  sourceChainSelector: bigint,
  remoteSender: Buffer,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('approved_ccip_sender'), selectorLeBytes(sourceChainSelector), remoteSender],
    receiverProgramId,
  )[0]
}

/**
 * Remote-sender seed bytes exactly as they appear inside a CCIP message. EVM addresses are
 * 20 bytes but CCIP carries them left-padded to 32 (bytes32, address in the low bytes) — the
 * receiver seeds `approved_ccip_sender` on the message's sender verbatim, so approvals and
 * message account lists must use the padded form. Other families (SVM: 32 bytes) pass through.
 */
export function remoteSenderSeedBytes(address: string): Buffer {
  const raw = Buffer.from(address.replace(/^0x/, ''), 'hex')
  if (raw.length === 20) return Buffer.concat([Buffer.alloc(12), raw])
  if (raw.length === 32) return raw
  throw new Error(`Unsupported remote sender address length: ${raw.length} bytes (expected 20 or 32)`)
}

/**
 * Receiver-specific accounts a CCIP 2.0 message to Solana must carry in its extraArgs
 * (`accounts` + `accountIsWritableBitmap`, encoded by the SDK as SVMExecutorArgsV1 in
 * `executorArgs`). The OffRamp supplies only the three standard accounts (external execution
 * authority, offramp program, allowed-offramp PDA) and requires the rest to arrive in the
 * message itself, in the receiver's Anchor declaration order.
 *
 * Layouts verified against the on-chain sources:
 * - ccip-receiver-v2 `ccip_receive_v2`: approved_sender, config, event_authority, program
 *   (the last two appended by `#[event_cpi]`; all readonly)
 * - ccip-basic-receiver `ccip_receive`: state, messages_storage (writable)
 */
export function receiverAccountsFor(
  receiverProgramId: PublicKey,
  sourceChainSelector: bigint,
  remoteSender: Buffer,
): { accounts: string[]; accountIsWritableBitmap: bigint } {
  const eventAuthority = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], receiverProgramId)[0]
  if (receiverProgramId.toBase58() === RECEIVER_V2_PROGRAM_ID) {
    return {
      accounts: [
        approvedSenderPda(receiverProgramId, sourceChainSelector, remoteSender).toBase58(),
        receiverConfigPda(receiverProgramId).toBase58(),
        eventAuthority.toBase58(),
        receiverProgramId.toBase58(),
      ],
      accountIsWritableBitmap: 0n,
    }
  }
  // ccip-basic-receiver (v1): state + messages_storage, the latter writable (bit 1)
  const state = PublicKey.findProgramAddressSync([Buffer.from('state')], receiverProgramId)[0]
  const messagesStorage = PublicKey.findProgramAddressSync([Buffer.from('messages_storage')], receiverProgramId)[0]
  return {
    accounts: [state.toBase58(), messagesStorage.toBase58()],
    accountIsWritableBitmap: 0b10n,
  }
}

// --- ccip-router ---

export function routerConfigPda(routerProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('config')], routerProgramId)[0]
}

export function routerEventAuthorityPda(routerProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], routerProgramId)[0]
}

// --- ccip-sender-v2 ---

export function senderStatePda(senderProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('state')], senderProgramId)[0]
}

export function ccipSenderPda(senderProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('ccip_sender')], senderProgramId)[0]
}

export function remoteChainConfigPda(senderProgramId: PublicKey, destChainSelector: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('remote_chain_config'), selectorLeBytes(destChainSelector)],
    senderProgramId,
  )[0]
}
