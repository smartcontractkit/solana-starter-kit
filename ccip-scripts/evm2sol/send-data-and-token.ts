/**
 * Send a combined data + token CCIP message from Ethereum Sepolia to Solana Devnet.
 *
 * Usage:
 *   npm run evm2sol:data-and-token -- --amount 1000000000 --message "Hello with tokens"
 *   npm run evm2sol:data-and-token -- --finality 5 --amount 1000000000
 */
import 'dotenv/config'

import { NO_EXECUTION_ADDRESS, type FinalityRequested } from '@chainlink/ccip-sdk'
import { PublicKey } from '@solana/web3.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  CCIP_EXPLORER_URL,
  DEFAULTS,
  ETHEREUM_SEPOLIA,
  ETHEREUM_SEPOLIA_SELECTOR,
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
import { receiverAccountsFor, remoteSenderSeedBytes } from '../utils/pdas.ts'

const argv = await ccipOptions(
  yargs(hideBin(process.argv))
    .option('message', {
      type: 'string',
      default: 'Hello from Ethereum, with tokens',
      describe: 'Message payload (plain text)',
    })
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
      default: SOLANA_DEVNET.receiverV2ProgramId,
      describe: 'Solana receiver program ID (default: ccip-receiver-v2; FTF requires it)',
    })
    .option('token-receiver', {
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
const senderAddress = await wallet.getAddress()
const { amount, decimals } = await parseTokenAmount(chain, argv.token, argv.amount)
// Tokens-with-data to Solana need an explicit tokenReceiver: the receiver program handles the
// message, while the tokens land in the token receiver's associated token account.
const tokenReceiver = argv.tokenReceiver ?? getSolanaWallet().publicKey.toBase58()
// The receiver's account list travels in the message (extraArgs `accounts`); see send-data.ts.
const receiverProgramId = new PublicKey(argv.receiver)
const { accounts, accountIsWritableBitmap } = receiverAccountsFor(
  receiverProgramId,
  ETHEREUM_SEPOLIA_SELECTOR,
  remoteSenderSeedBytes(senderAddress),
)

console.log('📨🪙 Ethereum → Solana: data + token')
console.log(`   Token:           ${argv.token}`)
console.log(`   Amount:          ${argv.amount} (${decimals} decimals → ${amount} base units)`)
console.log(`   Message:         ${argv.message}`)
console.log(`   Fee token:       ${argv.feeToken}`)
console.log(`   Receiver:        ${argv.receiver}`)
console.log(`   Token receiver:  ${tokenReceiver}`)
console.log(`   Finality:        ${finality ? describeFinality(finality) : 'finalized (default)'}`)
if (argv.exec === false) console.log('   Execution:       manual (no automated execution)')

const computeUnits =
  argv.computeUnits ??
  (await estimateGasLimit(
    chain,
    dest,
    ETHEREUM_SEPOLIA.router,
    {
      sender: senderAddress,
      receiver: argv.receiver,
      data: Buffer.from(argv.message, 'utf8'),
      tokenAmounts: [{ token: argv.token, amount }],
      extraArgs: { tokenReceiver },
      accounts,
      accountIsWritableBitmap,
    },
    DEFAULTS.svmComputeUnits,
  ))

const request = await chain.sendMessage({
  router: ETHEREUM_SEPOLIA.router,
  destChainSelector: SOLANA_DEVNET_SELECTOR,
  wallet,
  message: {
    receiver: argv.receiver,
    data: Buffer.from(argv.message, 'utf8'),
    tokenAmounts: [{ token: argv.token, amount }],
    feeToken: evmFeeTokenAddress(argv.feeToken),
    extraArgs: {
      gasLimit: BigInt(computeUnits),
      tokenReceiver,
      accounts,
      accountIsWritableBitmap,
      ...(finality !== undefined ? { finality } : {}),
      ...(argv.exec === false ? { executor: NO_EXECUTION_ADDRESS } : {}),
    },
  },
})

printRequest(request, ETHEREUM_SEPOLIA.txUrl)
console.log(`\n💡 Track it: ${CCIP_EXPLORER_URL}${request.message.messageId}`)
