/**
 * Manually execute a CCIP message on Solana Devnet that was sent from Ethereum
 * (e.g. one sent with --no-exec, or one whose automated execution failed).
 *
 * Usage:
 *   npm run evm2sol:manual-execute -- --message-id 0x...
 */
import 'dotenv/config'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { SOLANA_DEVNET } from '../utils/config.ts'
import { getSolanaChain, getSolanaWallet, toSdkWallet } from '../utils/chains.ts'

const argv = await yargs(hideBin(process.argv))
  .option('message-id', {
    type: 'string',
    demandOption: true,
    describe: 'CCIP message ID to execute (0x...)',
  })
  .option('compute-units', {
    type: 'number',
    describe: 'Compute units override for the ccip_receive call',
  })
  .parseAsync()

const chain = await getSolanaChain()
const keypair = getSolanaWallet()

// The SDK's execute() unconditionally sweeps the wallet's entire transaction history after
// the send (cleanUpBuffers: one getTransaction per signature — thousands of calls, tens of
// minutes on a public RPC) even though the execution already succeeded and buffers
// auto-close on success. Skip the sweep here; recycle leftover buffers/ALTs on demand
// with `npm run svm:cleanup`.
chain.cleanUpBuffers = async () => {}

console.log('🔧 Manual execution on Solana Devnet')
console.log(`   Message ID:      ${argv.messageId}`)

const result = await chain.execute({
  messageId: argv.messageId,
  wallet: toSdkWallet(keypair),
  ...(argv.computeUnits ? { gasLimit: argv.computeUnits } : {}),
})

console.log(`\n✅ Executed. State: ${result.receipt.state}`)
console.log(`   Tx: ${SOLANA_DEVNET.txUrl(result.log.transactionHash)}`)
