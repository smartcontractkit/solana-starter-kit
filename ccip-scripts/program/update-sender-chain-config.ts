/**
 * Update the ccip-sender-v2 program's stored chain config for Ethereum Sepolia —
 * the recipient, the receiver-callback gas limit, or the requested finality.
 *
 * Use this when gas requirements change; the program's sends take their extraArgs
 * (gas limit, finality) from this config, and CcipSendParams has no per-send override.
 *
 * Usage:
 *   npm run svm:sender-v2:config -- --gas-limit 500000
 *   npm run svm:sender-v2:config -- --recipient 0xNewReceiver
 *   npm run svm:sender-v2:config -- --finality 1
 *   npm run svm:sender-v2:config -- --remove        # disable the Sepolia lane
 */
import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor'
import { type FinalityRequested } from '@chainlink/ccip-sdk'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { DEFAULTS, ETHEREUM_SEPOLIA_SELECTOR, SOLANA_DEVNET, requireEnv } from '../utils/config.ts'
import { getSolanaWallet } from '../utils/chains.ts'
import { parseFinality } from '../utils/finality.ts'
import { decodeSenderExtraArgs, encodeSenderExtraArgs } from '../utils/extra-args.ts'
import { remoteChainConfigPda, senderStatePda } from '../utils/pdas.ts'

const here = dirname(fileURLToPath(import.meta.url))
const idl = JSON.parse(readFileSync(join(here, '..', '..', 'target', 'idl', 'ccip_sender_v2.json'), 'utf-8'))

const argv = await yargs(hideBin(process.argv))
  .option('recipient', {
    type: 'string',
    describe: 'EVM recipient address (default: keep the stored one / EVM_RECEIVER_ADDRESS)',
  })
  .option('gas-limit', {
    type: 'number',
    describe: 'Gas limit for the EVM receiver callback (default: keep the stored one / 400k)',
  })
  .option('finality', {
    type: 'string',
    describe: "Requested finality: 'finalized' (default), 'safe', or a block depth 1..65535",
  })
  .option('remove', {
    type: 'boolean',
    default: false,
    describe: 'Remove the Sepolia chain config (disables program sends; reversible via setup)',
  })
  .parseAsync()

const keypair = getSolanaWallet()
const connection = new Connection(SOLANA_DEVNET.rpcUrl, DEFAULTS.solanaCommitment)
const provider = new AnchorProvider(connection, new Wallet(keypair), {})
const program = new Program(idl, provider)
const senderProgramId = new PublicKey(SOLANA_DEVNET.senderV2ProgramId)
const statePda = senderStatePda(senderProgramId)
const chainConfig = remoteChainConfigPda(senderProgramId, ETHEREUM_SEPOLIA_SELECTOR)

console.log('⚙️  ccip-sender-v2 chain config (Sepolia)')
console.log(`   Program:         ${senderProgramId}`)
console.log(`   Chain config:    ${chainConfig}`)

if (argv.remove) {
  const sig = await program.methods
    .removeChainConfig(new BN(ETHEREUM_SEPOLIA_SELECTOR))
    .accounts({
      state: statePda,
      chainConfig,
      authority: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log(`\n✅ remove_chain_config: ${sig}`)
  process.exit(0)
}

// Read the stored config so unspecified fields keep their current values.
const account = await connection.getAccountInfo(chainConfig)
if (!account) throw new Error('Chain config not found. Run npm run svm:sender-v2:setup first.')
const data = account.data
let off = 8 + 1 + 1 // disc + version + bump
const recipientLen = data.readUInt32LE(off)
off += 4
const storedRecipient = '0x' + data.subarray(off, off + recipientLen).toString('hex')
off += recipientLen
const extraArgsLen = data.readUInt32LE(off)
off += 4
const storedExtraArgs = data.subarray(off, off + extraArgsLen)

// Decode the stored Borsh GenericExtraArgsV3 (tag a69dd4aa).
const decoded = decodeSenderExtraArgs(storedExtraArgs)
const storedGasLimit = Number(decoded.gasLimit)
const storedFinality: FinalityRequested = decoded.finality

const recipient = argv.recipient ?? storedRecipient ?? requireEnv('EVM_RECEIVER_ADDRESS')
const gasLimit = argv.gasLimit ?? storedGasLimit ?? DEFAULTS.evmGasLimit
const finality = parseFinality(argv.finality) ?? storedFinality

console.log(`   Recipient:       ${recipient}`)
console.log(`   Gas limit:       ${gasLimit}`)
console.log(`   Finality:        ${finality}`)

// Re-encode the full Borsh GenericExtraArgsV3; ccvs/executor stay empty so the lane defaults apply.
const extraArgsBytes = encodeSenderExtraArgs({
  gasLimit: BigInt(gasLimit),
  finality,
  ccvs: [],
  ccvArgs: [],
  executor: '',
  executorArgs: '0x',
  tokenReceiver: '',
  tokenArgs: '0x',
})

const sig = await program.methods
  .updateChainConfig({
    chainSelector: new BN(ETHEREUM_SEPOLIA_SELECTOR),
    recipient: Buffer.from(recipient.replace(/^0x/, ''), 'hex'),
    extraArgsBytes,
  })
  .accounts({
    state: statePda,
    chainConfig,
    authority: keypair.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc()
console.log(`\n✅ update_chain_config: ${sig}`)
