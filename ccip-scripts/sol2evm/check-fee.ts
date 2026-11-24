/**
 * Estimate the CCIP fee for a Solana → Ethereum message, without sending anything.
 *
 * Usage:
 *   npm run sol2evm:fee
 *   npm run sol2evm:fee -- --finality 5
 *   npm run sol2evm:fee -- --token-amount 1000000000
 */
import 'dotenv/config'

import { type FinalityRequested } from '@chainlink/ccip-sdk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { DEFAULTS, ETHEREUM_SEPOLIA, ETHEREUM_SEPOLIA_SELECTOR, SOLANA_DEVNET, requireEnv } from '../utils/config.ts'
import { describeFinality, estimateGasLimit, getEvmChain, getSolanaChain, parseTokenAmount } from '../utils/chains.ts'
import { ccipOptions, parseFinality } from '../utils/finality.ts'

const argv = await ccipOptions(
  yargs(hideBin(process.argv))
    .option('message', {
      type: 'string',
      default: 'Hello from Solana',
      describe: 'Message payload (plain text)',
    })
    .option('token-amount', {
      type: 'string',
      describe: 'Token amount in human-readable units (e.g. 1.5), to include a BnM transfer in the quote',
    })
    .option('receiver', {
      type: 'string',
      describe: 'EVM receiver contract address (default: EVM_RECEIVER_ADDRESS from .env)',
    })
    .option('gas-limit', {
      type: 'number',
      describe: 'Gas limit for the receiver ccipReceive callback (default: SDK estimate + 50%)',
    }),
).parseAsync()

const finality: FinalityRequested | undefined = parseFinality(argv.finality)
const receiver = argv.receiver ?? requireEnv('EVM_RECEIVER_ADDRESS')

const chain = await getSolanaChain()
const dest = await getEvmChain()
const tokenAmount = argv.tokenAmount
  ? await parseTokenAmount(chain, SOLANA_DEVNET.bnmTokenMint, argv.tokenAmount)
  : null

console.log('💰 Fee quote: Solana → Ethereum')
console.log(`   Finality:        ${finality ? describeFinality(finality) : 'finalized (default)'}`)
console.log(
  `   Token amount:    ${tokenAmount ? `${argv.tokenAmount} (${tokenAmount.decimals} decimals → ${tokenAmount.amount} base units)` : 'none (data only)'}`,
)

const gasLimit =
  argv.gasLimit ??
  (await estimateGasLimit(
    chain,
    dest,
    SOLANA_DEVNET.router,
    {
      sender: 'GY3V5RAtSxoJf2dZGqAbzaSxDyXWb8RPMWQdv1mC5PXN', // placeholder sender; estimation only needs the receiver
      receiver,
      data: Buffer.from(argv.message, 'utf8'),
      tokenAmounts: tokenAmount ? [{ token: SOLANA_DEVNET.bnmTokenMint, amount: tokenAmount.amount }] : [],
    },
    DEFAULTS.evmGasLimit,
  ))

const fee = await chain.getFee({
  router: SOLANA_DEVNET.router,
  destChainSelector: ETHEREUM_SEPOLIA_SELECTOR,
  message: {
    receiver,
    data: Buffer.from(argv.message, 'utf8'),
    ...(tokenAmount ? { tokenAmounts: [{ token: SOLANA_DEVNET.bnmTokenMint, amount: tokenAmount.amount }] } : {}),
    extraArgs: {
      gasLimit: BigInt(gasLimit),
      ...(finality !== undefined ? { finality } : {}),
    },
  },
})

console.log(`\n   Fee: ${fee} lamports (native SOL)`)
