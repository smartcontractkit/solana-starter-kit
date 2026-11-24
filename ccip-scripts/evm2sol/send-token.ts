/**
 * Send a token transfer over CCIP from Ethereum Sepolia to Solana Devnet.
 *
 * Usage:
 *   npm run evm2sol:token -- --amount 1000000000
 *   npm run evm2sol:token -- --token 0xFd57... --amount 5000000 --fee-token link
 *   npm run evm2sol:token -- --finality 5
 */
import 'dotenv/config'

import { NO_EXECUTION_ADDRESS, type FinalityRequested } from '@chainlink/ccip-sdk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  CCIP_EXPLORER_URL,
  DEFAULTS,
  ETHEREUM_SEPOLIA,
  SOLANA_DEVNET,
  SOLANA_DEVNET_SELECTOR,
  evmFeeTokenAddress,
} from '../utils/config.ts'
import {
  describeFinality,
  estimateGasLimit,
  getEvmChain,
  getEvmWallet,
  getSolanaChain,
  getSolanaWallet,
  parseTokenAmount,
  printRequest,
} from '../utils/chains.ts'
import { ccipOptions, parseFinality } from '../utils/finality.ts'

const argv = await ccipOptions(
  yargs(hideBin(process.argv))
    .option('token', {
      type: 'string',
      default: ETHEREUM_SEPOLIA.bnmTokenAddress,
      describe: 'ERC-20 token address to transfer (default: BnM)',
    })
    .option('amount', {
      type: 'string',
      demandOption: true,
      describe: 'Amount in human-readable units (e.g. 1.5), converted using the token decimals',
    })
    .option('fee-token', {
      type: 'string',
      choices: ['native', 'link', 'weth'],
      default: 'native',
      describe: 'Token to pay the CCIP fee in (weth = wrapped native ETH)',
    })
    .option('receiver', {
      type: 'string',
      describe: 'Solana address whose associated token account receives the tokens (default: your Solana wallet)',
    })
    .option('compute-units', {
      type: 'number',
      describe: 'Compute units for the receiver ccip_receive call (default: SDK estimate + 50%, fallback 100k)',
    }),
).parseAsync()

const finality: FinalityRequested | undefined = parseFinality(argv.finality)

const chain = await getEvmChain()
const dest = await getSolanaChain()
const wallet = getEvmWallet()
const { amount, decimals } = await parseTokenAmount(chain, argv.token, argv.amount)
// Token-only sends to Solana have no receiver program: the SDK maps `receiver` to the token
// receiver, whose associated token account is funded with the transferred tokens.
const receiver = argv.receiver ?? getSolanaWallet().publicKey.toBase58()

console.log('🪙 Ethereum → Solana: token transfer')
console.log(`   Token:           ${argv.token}`)
console.log(`   Amount:          ${argv.amount} (${decimals} decimals → ${amount} base units)`)
console.log(`   Fee token:       ${argv.feeToken}`)
console.log(`   Token receiver:  ${receiver}`)
console.log(`   Finality:        ${finality ? describeFinality(finality) : 'finalized (default)'}`)
if (argv.exec === false) console.log('   Execution:       manual (no automated execution)')

// Token-only sends set compute units 0: CCIP 2.0 then skips the receiver call entirely
// (pool-only CCVs, tokens still delivered to the token receiver's ATA) — the designed
// fast path. A non-zero value would make the executor attempt a receiver call it has
// not budgeted gas for.
const computeUnits =
  argv.computeUnits ??
  (await estimateGasLimit(
    chain,
    dest,
    ETHEREUM_SEPOLIA.router,
    {
      sender: await wallet.getAddress(),
      receiver,
      data: Buffer.alloc(0),
      tokenAmounts: [{ token: argv.token, amount }],
    },
    DEFAULTS.svmComputeUnits,
  ))

const request = await chain.sendMessage({
  router: ETHEREUM_SEPOLIA.router,
  destChainSelector: SOLANA_DEVNET_SELECTOR,
  wallet,
  message: {
    receiver,
    tokenAmounts: [{ token: argv.token, amount }],
    feeToken: evmFeeTokenAddress(argv.feeToken),
    extraArgs: {
      gasLimit: BigInt(computeUnits),
      ...(finality !== undefined ? { finality } : {}),
      ...(argv.exec === false ? { executor: NO_EXECUTION_ADDRESS } : {}),
    },
  },
})

printRequest(request, ETHEREUM_SEPOLIA.txUrl)
console.log(`\n💡 Track it: ${CCIP_EXPLORER_URL}${request.message.messageId}`)
