/**
 * Set up ccip-receiver-v2 on Solana Devnet: initialize, register with the router,
 * optionally set a ccv_config (finality policy) and approve a remote sender.
 *
 * Usage:
 *   npm run svm:receiver-v2:setup
 *   npm run svm:receiver-v2:setup -- --block-depth 1 --allow-safe   # FTF: accept safe or >=1 depth
 *   npm run svm:receiver-v2:setup -- --approve-sender 0xYourEvmAddress
 *
 * NOTE: running without --block-depth/--allow-safe sets (or downgrades to) finality-only.
 */
import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { DEFAULTS, ETHEREUM_SEPOLIA_SELECTOR, SOLANA_DEVNET } from '../utils/config.ts'
import { getSolanaWallet } from '../utils/chains.ts'
import { SVM_FINALITY_SAFE_FLAG } from '../utils/finality.ts'
import {
  approvedSenderPda,
  ccvConfigPda,
  programDataPda,
  receiverConfigPda,
  receiverRegistryPda,
  registrationSignerPda,
  remoteSenderSeedBytes,
  routerConfigPda,
  routerEventAuthorityPda,
} from '../utils/pdas.ts'

const here = dirname(fileURLToPath(import.meta.url))
const idl = JSON.parse(readFileSync(join(here, '..', '..', 'target', 'idl', 'ccip_receiver_v2.json'), 'utf-8'))

const argv = await yargs(hideBin(process.argv))
  .option('block-depth', {
    type: 'number',
    describe: 'Accept messages with >= N block confirmations (Faster-Than-Finality)',
  })
  .option('allow-safe', {
    type: 'boolean',
    default: false,
    describe: 'Also accept messages tagged safe (FCR)',
  })
  .option('approve-sender', {
    type: 'string',
    describe: 'EVM address (0x...) allowed to send to this receiver',
  })
  .parseAsync()

const keypair = getSolanaWallet()
const connection = new Connection(SOLANA_DEVNET.rpcUrl, DEFAULTS.solanaCommitment)
const provider = new AnchorProvider(connection, new Wallet(keypair), {})
const program = new Program(idl, provider)
const receiverProgramId = new PublicKey(SOLANA_DEVNET.receiverV2ProgramId)
const routerProgramId = new PublicKey(SOLANA_DEVNET.router)

const configPda = receiverConfigPda(receiverProgramId)
const registrationSigner = registrationSignerPda(receiverProgramId, routerProgramId)
const receiverRegistry = receiverRegistryPda(receiverProgramId, routerProgramId)
const routerConfig = routerConfigPda(routerProgramId)
const ccvConfig = ccvConfigPda(receiverProgramId, ETHEREUM_SEPOLIA_SELECTOR)

console.log('🛠  ccip-receiver-v2 setup')
console.log(`   Program:         ${receiverProgramId}`)
console.log(`   Router:          ${routerProgramId}`)
console.log(`   Config PDA:      ${configPda}`)

// 1. initialize (only the program's upgrade authority may call it; fails if already initialized)
try {
  const sig = await program.methods
    .initialize(routerProgramId)
    .accounts({
      config: configPda,
      authority: keypair.publicKey,
      systemProgram: SystemProgram.programId,
      program: receiverProgramId,
      programData: programDataPda(receiverProgramId),
    })
    .rpc()
  console.log(`\n✅ initialize: ${sig}`)
} catch (err) {
  console.log(`\n⏭  initialize skipped (likely already initialized): ${(err as Error).message.split('\n')[0]}`)
}

// 2. register_with_router (CPIs the router's register_receiver as v2)
try {
  const sig = await program.methods
    .registerWithRouter()
    .accounts({
      config: configPda,
      authority: keypair.publicKey,
      registrationSigner,
      routerProgram: routerProgramId,
      receiverRegistry,
      routerConfig,
      routerEventAuthority: routerEventAuthorityPda(routerProgramId),
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts([{ pubkey: receiverProgramId, isSigner: false, isWritable: false }])
    .rpc()
  console.log(`✅ register_with_router: ${sig}`)
} catch (err) {
  console.log(`⏭  register_with_router skipped: ${(err as Error).message.split('\n')[0]}`)
}

// 3. set_ccv_config (finality policy for the Sepolia lane)
if (argv.blockDepth !== undefined || argv.allowSafe) {
  const flags = argv.allowSafe ? SVM_FINALITY_SAFE_FLAG : 0x0000
  const blockDepth = argv.blockDepth ?? 0
  const sig = await program.methods
    .setCcvConfig({
      sourceChainSelector: new BN(ETHEREUM_SEPOLIA_SELECTOR),
      requiredCcvs: [],
      optionalCcvs: [],
      optionalThreshold: 0,
      allowedFinalityConfig: { flags: new BN(flags), blockDepth: new BN(blockDepth) },
    })
    .accounts({
      config: configPda,
      sourceChainCcvConfig: ccvConfig,
      authority: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log(`✅ set_ccv_config (flags=0x${flags.toString(16)}, depth=${blockDepth}): ${sig}`)
} else {
  console.log('⏭  set_ccv_config skipped (no --block-depth/--allow-safe given; finality-only remains)')
}

// 4. approve_sender (optional)
if (argv.approveSender) {
  // The receiver seeds approved_ccip_sender on the message's sender bytes verbatim: EVM
  // addresses travel inside CCIP messages left-padded to 32 bytes, so the approval must use
  // the padded form too (see remoteSenderSeedBytes).
  const remoteSender = remoteSenderSeedBytes(argv.approveSender)
  const approvedSender = approvedSenderPda(receiverProgramId, ETHEREUM_SEPOLIA_SELECTOR, remoteSender)
  const sig = await program.methods
    .approveSender({ chainSelector: new BN(ETHEREUM_SEPOLIA_SELECTOR), remoteSender })
    .accounts({
      config: configPda,
      approvedSender,
      authority: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log(`✅ approve_sender (${argv.approveSender}): ${sig}`)
}

console.log('\nDone. Verify with: npm run svm:receiver-v2:status')
