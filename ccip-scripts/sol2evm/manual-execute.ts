/**
 * Manually execute a CCIP message on Ethereum Sepolia that was sent from Solana
 * (e.g. one sent with --no-exec, or one whose automated execution failed).
 *
 * Usage:
 *   npm run sol2evm:manual-execute -- --message-id 0x...
 */
import 'dotenv/config'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { ETHEREUM_SEPOLIA } from '../utils/config.ts'
import { getEvmChain, getEvmWallet } from '../utils/chains.ts'

const argv = await yargs(hideBin(process.argv))
  .option('message-id', {
    type: 'string',
    demandOption: true,
    describe: 'CCIP message ID to execute (0x...)',
  })
  .option('gas-limit', {
    type: 'number',
    describe: 'Gas limit override for the ccipReceive call',
  })
  .parseAsync()

const chain = await getEvmChain()
const wallet = getEvmWallet()

console.log('🔧 Manual execution on Ethereum Sepolia')
console.log(`   Message ID:      ${argv.messageId}`)

const result = await chain.execute({
  messageId: argv.messageId,
  wallet,
  ...(argv.gasLimit ? { gasLimit: argv.gasLimit } : {}),
})

console.log(`\n✅ Executed. State: ${result.receipt.state}`)
console.log(`   Tx: ${ETHEREUM_SEPOLIA.txUrl(result.log.transactionHash)}`)
