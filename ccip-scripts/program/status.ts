/**
 * Read-only status check for the CCIP programs on Solana Devnet:
 * receiver-v2 config/registration/ccv_config, sender-v2 state/chain config.
 *
 * Usage:
 *   npm run svm:receiver-v2:status
 */
import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'

import { DEFAULTS, ETHEREUM_SEPOLIA_SELECTOR, SOLANA_DEVNET } from '../utils/config.ts'
import {
  ccvConfigPda,
  receiverConfigPda,
  receiverRegistryPda,
  remoteChainConfigPda,
  senderStatePda,
} from '../utils/pdas.ts'
import { SVM_FINALITY_SAFE_FLAG } from '../utils/finality.ts'

const here = dirname(fileURLToPath(import.meta.url))
const receiverIdl = JSON.parse(readFileSync(join(here, '..', '..', 'target', 'idl', 'ccip_receiver_v2.json'), 'utf-8'))
const senderIdl = JSON.parse(readFileSync(join(here, '..', '..', 'target', 'idl', 'ccip_sender_v2.json'), 'utf-8'))

const keypair = (await import('../utils/chains.ts')).getSolanaWallet()
const connection = new Connection(SOLANA_DEVNET.rpcUrl, DEFAULTS.solanaCommitment)
const provider = new AnchorProvider(connection, new (await import('@coral-xyz/anchor')).Wallet(keypair), {})
const receiverProgram = new Program(receiverIdl, provider)
const senderProgram = new Program(senderIdl, provider)

const receiverProgramId = new PublicKey(SOLANA_DEVNET.receiverV2ProgramId)
const senderProgramId = new PublicKey(SOLANA_DEVNET.senderV2ProgramId)
const routerProgramId = new PublicKey(SOLANA_DEVNET.router)

const receiverConfig = receiverConfigPda(receiverProgramId)
const ccvConfig = ccvConfigPda(receiverProgramId, ETHEREUM_SEPOLIA_SELECTOR)
const receiverRegistry = receiverRegistryPda(receiverProgramId, routerProgramId)
const senderState = senderStatePda(senderProgramId)
const senderChainConfig = remoteChainConfigPda(senderProgramId, ETHEREUM_SEPOLIA_SELECTOR)

console.log('📋 CCIP program status (Solana Devnet)\n')

// --- receiver-v2 ---
console.log(`ccip-receiver-v2: ${receiverProgramId}`)
const receiverConfigAccount = await connection.getAccountInfo(receiverConfig)
if (receiverConfigAccount) {
  const decoded = receiverProgram.coder.accounts.decode('config', receiverConfigAccount.data)
  console.log(`   Config:          initialized (router: ${decoded.router}, owner: ${decoded.owner})`)
} else {
  console.log('   Config:          NOT initialized')
}

const registry = await connection.getAccountInfo(receiverRegistry)
console.log(`   Router registry: ${registry ? 'registered' : 'NOT registered'}`)

const ccvConfigAccount = await connection.getAccountInfo(ccvConfig)
if (ccvConfigAccount) {
  const decoded = receiverProgram.coder.accounts.decode('sourceChainCcvConfig', ccvConfigAccount.data)
  const flags = Number(decoded.allowedFinalityConfig.flags)
  const depth = Number(decoded.allowedFinalityConfig.blockDepth)
  const policy =
    flags & SVM_FINALITY_SAFE_FLAG
      ? depth > 0
        ? `safe or >=${depth} blocks`
        : 'safe'
      : depth > 0
        ? `>=${depth} blocks`
        : 'finalized only'
  console.log(`   ccv_config:      ${policy} (Sepolia lane)`)
} else {
  console.log('   ccv_config:      none (finalized only)')
}

// --- sender-v2 ---
console.log(`\nccip-sender-v2: ${senderProgramId}`)
const senderStateAccount = await connection.getAccountInfo(senderState)
if (senderStateAccount) {
  const decoded = senderProgram.coder.accounts.decode('baseState', senderStateAccount.data)
  console.log(`   State:           initialized (router: ${decoded.router}, owner: ${decoded.owner})`)
} else {
  console.log('   State:           NOT initialized')
}

const chainConfigAccount = await connection.getAccountInfo(senderChainConfig)
console.log(`   Sepolia config:  ${chainConfigAccount ? 'created' : 'NOT created (run svm:sender-v2:setup)'}`)
