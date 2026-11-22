/**
 * Close leftover CCIP execution buffers and recycle Address Lookup Tables owned by your
 * wallet (rent recovery). The SDK's execute() normally does this automatically, but its
 * sweep scans the wallet's full transaction history — the manual-execute script skips it
 * to return promptly, so run this occasionally instead.
 *
 * Usage:
 *   npm run svm:cleanup
 *   npm run svm:cleanup -- --wait-deactivation   # also wait out the ALT cooldown (~3.5 min) and close them
 */
import 'dotenv/config'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { getSolanaChain, getSolanaWallet, toSdkWallet } from '../utils/chains.ts'

const argv = await yargs(hideBin(process.argv))
  .option('wait-deactivation', {
    type: 'boolean',
    describe: 'Wait out the ALT deactivation cooldown (~3.5 min) and close them too',
  })
  .parseAsync()

const chain = await getSolanaChain()
const keypair = getSolanaWallet()

console.log('🧹 Cleaning up CCIP buffers and lookup tables')
console.log(`   Wallet:          ${keypair.publicKey.toBase58()}`)
console.log('   Note:            scans your full transaction history — slow on public RPC')

await chain.cleanUpBuffers({
  wallet: toSdkWallet(keypair),
  ...(argv.waitDeactivation ? { waitDeactivation: true } : {}),
})

console.log('\n✅ Cleanup complete')
