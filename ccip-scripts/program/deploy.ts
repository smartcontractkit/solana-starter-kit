/**
 * Deploy an Anchor program from this kit to Solana Devnet.
 *
 * Usage:
 *   npm run svm:program:deploy -- --program ccip-receiver-v2
 *   npm run svm:program:deploy -- --program ccip-sender-v2
 *   npm run svm:program:deploy -- --program ccip-basic-receiver
 *
 * Requires `anchor build` (npm run svm:program:build) to have produced the .so.
 */
import 'dotenv/config'

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Keypair } from '@solana/web3.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

const PROGRAMS = {
  'ccip-basic-receiver': 'ccip_basic_receiver',
  'ccip-receiver-v2': 'ccip_receiver_v2',
  'ccip-sender-v2': 'ccip_sender_v2',
  'chainlink-solana-demo': 'chainlink_solana_demo',
} as const

type ProgramName = keyof typeof PROGRAMS

const argv = await yargs(hideBin(process.argv))
  .option('program', {
    type: 'string',
    demandOption: true,
    choices: Object.keys(PROGRAMS),
    describe: 'Program to deploy',
  })
  .option('upgrade-authority', {
    type: 'string',
    describe: 'Upgrade authority to set (defaults to the wallet)',
  })
  .parseAsync()

const program = argv.program as ProgramName
const libName = PROGRAMS[program]
const soPath = join(root, 'target', 'deploy', `${libName}.so`)
const keypairPath = join(root, 'target', 'deploy', `${libName}-keypair.json`)

if (!existsSync(soPath)) {
  console.error(`❌ ${soPath} not found. Run \`npm run svm:program:build\` first.`)
  process.exit(1)
}
if (!existsSync(keypairPath)) {
  console.error(
    `❌ ${keypairPath} not found. Generate it with:\n   solana-keygen new --no-bip39-passphrase --outfile ${keypairPath}`,
  )
  process.exit(1)
}

const programId = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf-8')) as number[]),
).publicKey

console.log(`🚀 Deploying ${program} to Solana Devnet`)
console.log(`   Program ID:      ${programId}`)
console.log(`   Binary:          ${soPath}`)
console.log(`   Buffer recovery phrase will print below — it is normal, not an error.\n`)

execFileSync(
  'solana',
  [
    'program',
    'deploy',
    soPath,
    '--program-id',
    keypairPath,
    '-u',
    'devnet',
    ...(argv.upgradeAuthority ? ['--upgrade-authority', argv.upgradeAuthority] : []),
  ],
  { stdio: 'inherit' },
)

console.log(`\n✅ ${program} deployed: https://explorer.solana.com/address/${programId}?cluster=devnet`)
