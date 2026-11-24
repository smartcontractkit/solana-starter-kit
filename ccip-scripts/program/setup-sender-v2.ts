/**
 * Set up ccip-sender-v2 on Solana Devnet: initialize, then create the destination
 * chain config for Ethereum Sepolia (required before the program can send).
 *
 * Usage:
 *   npm run svm:sender-v2:setup
 *   npm run svm:sender-v2:setup -- --recipient 0xYourReceiver
 */
import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { DEFAULTS, ETHEREUM_SEPOLIA, ETHEREUM_SEPOLIA_SELECTOR, SOLANA_DEVNET, requireEnv } from '../utils/config.ts'
import { getSolanaWallet } from '../utils/chains.ts'
import { defaultSenderExtraArgs, encodeSenderExtraArgs } from '../utils/extra-args.ts'
import { ccipSenderPda, programDataPda, remoteChainConfigPda, senderStatePda } from '../utils/pdas.ts'

const here = dirname(fileURLToPath(import.meta.url))
const idl = JSON.parse(readFileSync(join(here, '..', '..', 'target', 'idl', 'ccip_sender_v2.json'), 'utf-8'))

const argv = await yargs(hideBin(process.argv))
  .option('recipient', {
    type: 'string',
    describe: 'EVM recipient address (default: EVM_RECEIVER_ADDRESS from .env)',
  })
  .option('gas-limit', {
    type: 'number',
    default: DEFAULTS.evmGasLimit,
    describe: 'Gas limit for the EVM receiver callback stored in the chain config (default: 400k)',
  })
  .parseAsync()

const keypair = getSolanaWallet()
const connection = new Connection(SOLANA_DEVNET.rpcUrl, DEFAULTS.solanaCommitment)
const provider = new AnchorProvider(connection, new Wallet(keypair), {})
const program = new Program(idl, provider)
const senderProgramId = new PublicKey(SOLANA_DEVNET.senderV2ProgramId)
const routerProgramId = new PublicKey(SOLANA_DEVNET.router)
const recipient = argv.recipient ?? requireEnv('EVM_RECEIVER_ADDRESS')

const statePda = senderStatePda(senderProgramId)
const ccipSender = ccipSenderPda(senderProgramId)
const chainConfig = remoteChainConfigPda(senderProgramId, ETHEREUM_SEPOLIA_SELECTOR)

console.log('🛠  ccip-sender-v2 setup')
console.log(`   Program:         ${senderProgramId}`)
console.log(`   Router:          ${routerProgramId}`)
console.log(`   Recipient:       ${recipient}`)

// 1. initialize (only the program's upgrade authority may call it)
try {
  const sig = await program.methods
    .initialize(routerProgramId)
    .accounts({
      state: statePda,
      ccipSender,
      authority: keypair.publicKey,
      systemProgram: SystemProgram.programId,
      program: senderProgramId,
      programData: programDataPda(senderProgramId),
    })
    .rpc()
  console.log(`\n✅ initialize: ${sig}`)
} catch (err) {
  console.log(`\n⏭  initialize skipped (likely already initialized): ${(err as Error).message.split('\n')[0]}`)
}

// 2. init_chain_config for Sepolia (recipient + extra args the program sends with).
//    The extra args are a full Borsh GenericExtraArgsV3 (tag a69dd4aa) — the layout the
//    router's parse_extra_args_with_defaults deserializes. The router never defaults
//    the gas limit — empty extra args would send data messages with gasLimit 0, which the
//    EVM executor then calls the receiver with (reverts as ReceiverError with empty data).
//    ccvs/executor stay empty so the lane defaults apply; finality 0 = finalized.
const extraArgsBytes = encodeSenderExtraArgs(defaultSenderExtraArgs(BigInt(argv.gasLimit), 'finalized'))
const chainConfigParams = {
  chainSelector: new BN(ETHEREUM_SEPOLIA_SELECTOR),
  recipient: Buffer.from(recipient.replace(/^0x/, ''), 'hex'),
  extraArgsBytes,
}
try {
  const sig = await program.methods
    .initChainConfig(chainConfigParams)
    .accounts({
      state: statePda,
      chainConfig,
      authority: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log(`✅ init_chain_config (Sepolia): ${sig}`)
} catch (err) {
  // Already initialized: update instead (changing the extra args needs a realloc).
  const sig = await program.methods
    .updateChainConfig(chainConfigParams)
    .accounts({
      state: statePda,
      chainConfig,
      authority: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log(`✅ update_chain_config (Sepolia): ${sig}`)
}
console.log(`   extraArgs:      gasLimit=${argv.gasLimit}, finality=finalized (${extraArgsBytes.length} bytes)`)

console.log('\nDone. The program can now ccip_send to Sepolia.')
