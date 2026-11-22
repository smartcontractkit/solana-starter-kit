/**
 * Estimate the CCIP fee for an Ethereum → Solana message, without sending anything.
 *
 * Usage:
 *   npm run evm2sol:fee
 *   npm run evm2sol:fee -- --finality 5
 *   npm run evm2sol:fee -- --token-amount 1000000000000000000
 */
import 'dotenv/config'

import { type FinalityRequested } from '@chainlink/ccip-sdk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { DEFAULTS, ETHEREUM_SEPOLIA, SOLANA_DEVNET, SOLANA_DEVNET_SELECTOR } from '../utils/config.ts'
import {
  describeFinality,
  estimateGasLimit,
  getEvmChain,
  getSolanaChain,
  getSolanaWallet,
  parseTokenAmount,
} from '../utils/chains.ts'
import { ccipOptions, parseFinality } from '../utils/finality.ts'

const argv = await ccipOptions(
  yargs(hideBin(process.argv))
    .option('message', {
      type: 'string',
      default: 'Hello from Ethereum',
      describe: 'Message payload (plain text)',
    })
    .option('token-amount', {
      type: 'string',
      describe: 'Token amount in human-readable units (e.g. 1.5), to include a BnM transfer in the quote',
    })
    .option('receiver', {
      type: 'string',
      default: SOLANA_DEVNET.receiverV2ProgramId,
      describe: 'Solana receiver program ID',
    })
    .option('token-receiver', {
      type: 'string',
      describe:
        'Solana address whose associated token account receives the tokens, when --token-amount is set (default: your Solana wallet)',
    })
    .option('compute-units', {
      type: 'number',
      describe: 'Compute units for the receiver ccip_receive call (default: SDK estimate + 50%, fallback 100k)',
    }),
).parseAsync()

const finality: FinalityRequested | undefined = parseFinality(argv.finality)

const chain = await getEvmChain()
const dest = await getSolanaChain()
const tokenReceiver = argv.tokenReceiver ?? getSolanaWallet().publicKey.toBase58()
const tokenAmount = argv.tokenAmount
  ? await parseTokenAmount(chain, ETHEREUM_SEPOLIA.bnmTokenAddress, argv.tokenAmount)
  : null

console.log('💰 Fee quote: Ethereum → Solana')
console.log(`   Finality:        ${finality ? describeFinality(finality) : 'finalized (default)'}`)
console.log(
  `   Token amount:    ${tokenAmount ? `${argv.tokenAmount} (${tokenAmount.decimals} decimals → ${tokenAmount.amount} base units)` : 'none (data only)'}`,
)
if (tokenAmount) console.log(`   Token receiver:  ${tokenReceiver}`)

const computeUnits =
  argv.computeUnits ??
  (await estimateGasLimit(
    chain,
    dest,
    ETHEREUM_SEPOLIA.router,
    {
      sender: '0x8C244f0B2164E6A3BED74ab429B0ebd661Bb14CA', // placeholder sender; estimation only needs the receiver
      receiver: argv.receiver,
      data: Buffer.from(argv.message, 'utf8'),
      tokenAmounts: tokenAmount ? [{ token: ETHEREUM_SEPOLIA.bnmTokenAddress, amount: tokenAmount.amount }] : [],
      ...(tokenAmount ? { extraArgs: { tokenReceiver } } : {}),
    },
    DEFAULTS.svmComputeUnits,
  ))

const fee = await chain.getFee({
  router: ETHEREUM_SEPOLIA.router,
  destChainSelector: SOLANA_DEVNET_SELECTOR,
  message: {
    receiver: argv.receiver,
    data: Buffer.from(argv.message, 'utf8'),
    ...(tokenAmount ? { tokenAmounts: [{ token: ETHEREUM_SEPOLIA.bnmTokenAddress, amount: tokenAmount.amount }] } : {}),
    extraArgs: {
      gasLimit: BigInt(computeUnits),
      ...(argv.tokenAmount ? { tokenReceiver } : {}),
      ...(finality !== undefined ? { finality } : {}),
    },
  },
})

console.log(`\n   Fee: ${fee} wei (native ETH)`)
