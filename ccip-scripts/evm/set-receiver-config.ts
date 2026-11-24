/**
 * Set the per-source-chain finality policy on the deployed BasicCCIPReceiver (Ethereum Sepolia).
 *
 * The receiver's `getCCVsAndFinalityConfig` (queried by the OffRamp before execution) returns the
 * owner-set policy for the message's source chain; unset chains accept fully finalized messages
 * only. This script is the EVM analog of the Solana receiver's `set_ccv_config`.
 *
 * Usage:
 *   npm run evm:receiver:config -- --finality finalized          # finality-only (default)
 *   npm run evm:receiver:config -- --finality safe               # finalized or safe-tagged
 *   npm run evm:receiver:config -- --finality 1                  # FTF: finalized or >= 1 block
 *   npm run evm:receiver:config -- --finality 1 --allow-safe     # FTF + safe-tagged
 *   npm run evm:receiver:config -- --remove                      # delete the config (finality-only)
 */
import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ethers } from 'ethers'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { ETHEREUM_SEPOLIA, SOLANA_DEVNET_SELECTOR, requireEnv } from '../utils/config.ts'
import { getEvmWallet } from '../utils/chains.ts'

const here = dirname(fileURLToPath(import.meta.url))
const artifact = JSON.parse(
  readFileSync(join(here, '..', '..', 'contracts', 'evm', 'BasicCCIPReceiver.json'), 'utf-8'),
) as {
  abi: ethers.InterfaceAbi
}

const argv = await yargs(hideBin(process.argv))
  .option('receiver', {
    type: 'string',
    default: requireEnv('EVM_RECEIVER_ADDRESS'),
    describe: 'Deployed BasicCCIPReceiver address (default: EVM_RECEIVER_ADDRESS)',
  })
  .option('source-chain', {
    type: 'string',
    describe: 'Source chain selector to configure (default: Solana Devnet)',
  })
  .option('finality', {
    type: 'string',
    default: 'finalized',
    describe: "Policy: 'finalized', 'safe', or a block depth 1..65535",
  })
  .option('allow-safe', {
    type: 'boolean',
    default: false,
    describe: 'Additionally accept messages tagged safe (FCR)',
  })
  .option('remove', {
    type: 'boolean',
    default: false,
    describe: 'Remove the source chain config (reverts to finality-only)',
  })
  .parseAsync()

// FinalityCodec (chainlink contracts-ccip): bit 16 = safe flag, low 16 bits = block depth.
const WAIT_FOR_SAFE_FLAG = 0x00010000
const encodeFinality = (finality: string, allowSafe: boolean): string => {
  let encoded: number
  if (finality === 'finalized') encoded = 0
  else if (finality === 'safe') encoded = WAIT_FOR_SAFE_FLAG
  else {
    const depth = Number(finality)
    if (!Number.isInteger(depth) || depth < 1 || depth > 65535)
      throw new Error(`Invalid --finality "${finality}": use 'finalized', 'safe', or a block depth 1..65535`)
    encoded = depth
  }
  if (allowSafe && finality !== 'finalized') encoded |= WAIT_FOR_SAFE_FLAG
  return '0x' + encoded.toString(16).padStart(8, '0')
}

const wallet = getEvmWallet()
const contract = new ethers.Contract(argv.receiver, artifact.abi, wallet)
const sourceChainSelector = BigInt(argv.sourceChain ?? SOLANA_DEVNET_SELECTOR)

console.log('⚙️  BasicCCIPReceiver source-chain config')
console.log(`   Receiver:        ${argv.receiver}`)
console.log(`   Source chain:    ${sourceChainSelector} (Solana Devnet)`)

if (argv.remove) {
  console.log('   Action:          remove (revert to finality-only)')
  const tx = await contract.removeSourceChainConfig(sourceChainSelector)
  console.log(`   Tx:              ${ETHEREUM_SEPOLIA.txUrl(tx.hash)}`)
  await tx.wait()
  console.log('\n✅ Config removed')
} else {
  const allowedFinalityConfig = encodeFinality(argv.finality, argv.allowSafe)
  const describe =
    argv.finality === 'finalized'
      ? 'finalized only'
      : argv.finality === 'safe'
        ? 'finalized or safe-tagged'
        : `finalized or >= ${argv.finality} block${Number(argv.finality) > 1 ? 's' : ''}${argv.allowSafe ? ' or safe-tagged' : ''}`
  console.log(`   Policy:          ${describe}`)
  console.log(`   Encoded:         ${allowedFinalityConfig}`)
  const tx = await contract.setSourceChainConfig(sourceChainSelector, allowedFinalityConfig)
  console.log(`   Tx:              ${ETHEREUM_SEPOLIA.txUrl(tx.hash)}`)
  await tx.wait()
  console.log('\n✅ Config set')
}
