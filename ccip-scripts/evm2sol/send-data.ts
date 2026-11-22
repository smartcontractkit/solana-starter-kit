/**
 * Send a data-only CCIP message from Ethereum Sepolia to Solana Devnet.
 *
 * Usage:
 *   npm run evm2sol:data -- --message "Hello from Ethereum"
 *   npm run evm2sol:data -- --finality 5            # Faster-Than-Finality (needs ccip-receiver-v2)
 *   npm run evm2sol:data -- --finality safe
 *   npm run evm2sol:data -- --no-exec               # skip automated execution, execute manually later
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
  printRequest,
} from '../utils/chains.ts'
import { ccipOptions, parseFinality } from '../utils/finality.ts'
import { receiverAccountsFor, remoteSenderSeedBytes } from '../utils/pdas.ts'

const argv = await ccipOptions(
  yargs(hideBin(process.argv))
    .option('message', {
      type: 'string',
      default: 'Hello from Ethereum',
      describe: 'Message payload (plain text)',
    })
    .option('receiver', {
      type: 'string',
      default: SOLANA_DEVNET.receiverV2ProgramId,
      describe: 'Solana receiver program ID (default: ccip-receiver-v2; FTF requires it)',
    })
    .option('compute-units', {
      type: 'number',
      describe: 'Compute units for the receiver ccip_receive call (default: SDK estimate + 50%, fallback 100k)',
    })
    .option('fee-token', {
      type: 'string',
      choices: ['native', 'link', 'weth'],
      default: 'native',
      describe: 'Token to pay the CCIP fee in (weth = wrapped native ETH)',
    }),
).parseAsync()

const finality: FinalityRequested | undefined = parseFinality(argv.finality)

const chain = await getEvmChain()
const dest = await getSolanaChain()
const wallet = getEvmWallet()
const senderAddress = await wallet.getAddress()

// CCIP 2.0 messages to Solana carry the receiver's account list in the message itself
// (extraArgs `accounts`, encoded as SVMExecutorArgsV1): the OffRamp supplies only the three
// standard accounts and requires the receiver-specific ones to arrive this way, in the
// receiver's Anchor declaration order.
const receiverProgramId = new PublicKey(argv.receiver)
const { accounts, accountIsWritableBitmap } = receiverAccountsFor(
  receiverProgramId,
  ETHEREUM_SEPOLIA_SELECTOR,
  remoteSenderSeedBytes(senderAddress),
)

console.log('📨 Ethereum → Solana: data message')
console.log(`   Receiver:        ${argv.receiver}`)
console.log(`   Message:         ${argv.message}`)
console.log(`   Finality:        ${finality ? describeFinality(finality) : 'finalized (default)'}`)
if (argv.exec === false) console.log('   Execution:       manual (no automated execution)')
if (finality !== undefined && argv.receiver !== SOLANA_DEVNET.receiverV2ProgramId) {
  console.warn('\n⚠️  Faster-Than-Finality requires the v2 receiver program (ccip-receiver-v2) with a ccv_config set.')
}

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
      tokenAmounts: [],
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
    feeToken: evmFeeTokenAddress(argv.feeToken),
    extraArgs: {
      gasLimit: BigInt(computeUnits),
      accounts,
      accountIsWritableBitmap,
      ...(finality !== undefined ? { finality } : {}),
      ...(argv.exec === false ? { executor: NO_EXECUTION_ADDRESS } : {}),
    },
  },
})

printRequest(request, ETHEREUM_SEPOLIA.txUrl)
console.log(`\n💡 Track it: ${CCIP_EXPLORER_URL}${request.message.messageId}`)
