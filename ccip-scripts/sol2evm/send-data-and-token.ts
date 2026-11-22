/**
 * Send a combined data + token CCIP message from Solana Devnet to Ethereum Sepolia.
 *
 * Usage:
 *   npm run sol2evm:data-and-token -- --amount 1000000000 --message "Hello with tokens"
 *   npm run sol2evm:data-and-token -- --finality 5 --amount 1000000000
 */
import 'dotenv/config'

import { type FinalityRequested } from '@chainlink/ccip-sdk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  CCIP_EXPLORER_URL,
  DEFAULTS,
  ETHEREUM_SEPOLIA,
  ETHEREUM_SEPOLIA_SELECTOR,
  SOLANA_DEVNET,
  requireEnv,
  solanaFeeTokenMint,
  SVM_NO_EXECUTION_PUBKEY,
} from '../utils/config.ts'
import {
  describeFinality,
  estimateGasLimit,
  getEvmChain,
  getSolanaChain,
  getSolanaWallet,
  parseTokenAmount,
  printRequest,
  toSdkWallet,
} from '../utils/chains.ts'
import { ccipOptions, parseFinality } from '../utils/finality.ts'
import { sendViaSenderProgram } from '../utils/sender-program.ts'

const argv = await ccipOptions(
  yargs(hideBin(process.argv))
    .option('message', {
      type: 'string',
      default: 'Hello from Solana, with tokens',
      describe: 'Message payload (plain text)',
    })
    .option('token', {
      type: 'string',
      default: SOLANA_DEVNET.bnmTokenMint,
      describe: 'Token mint to transfer (default: BnM)',
    })
    .option('amount', {
      type: 'string',
      demandOption: true,
      describe: 'Amount in human-readable units (e.g. 1.5), converted using the token decimals',
    })
    .option('fee-token', {
      type: 'string',
      choices: ['native', 'link', 'wsol'],
      default: 'native',
      describe: 'Token to pay the CCIP fee in (wsol = wrapped SOL mint)',
    })
    .option('receiver', {
      type: 'string',
      describe: 'EVM receiver contract address (default: EVM_RECEIVER_ADDRESS from .env)',
    })
    .option('gas-limit', {
      type: 'number',
      describe: 'Gas limit for the receiver ccipReceive callback (default: SDK estimate + 50%)',
    })
    .option('sender-program', {
      type: 'string',
      describe:
        'Send through the ccip-sender-v2 program at this address (per-send flags override its stored chain config)',
    }),
).parseAsync()

const finality: FinalityRequested | undefined = parseFinality(argv.finality)
const receiver = argv.receiver ?? requireEnv('EVM_RECEIVER_ADDRESS')

const chain = await getSolanaChain()
const dest = await getEvmChain()
const keypair = getSolanaWallet()
const { amount, decimals } = await parseTokenAmount(chain, argv.token, argv.amount)

console.log('📨🪙 Solana → Ethereum: data + token')
console.log(`   Token:           ${argv.token}`)
console.log(`   Amount:          ${argv.amount} (${decimals} decimals → ${amount} base units)`)
console.log(`   Message:         ${argv.message}`)
console.log(`   Fee token:       ${argv.feeToken}`)
console.log(`   Receiver:        ${receiver}`)
console.log(`   Finality:        ${finality ? describeFinality(finality) : 'finalized (default)'}`)
if (argv.exec === false) console.log('   Execution:       manual (no automated execution)')

const gasLimit =
  argv.gasLimit ??
  (await estimateGasLimit(
    chain,
    dest,
    SOLANA_DEVNET.router,
    {
      sender: keypair.publicKey.toBase58(),
      receiver,
      data: Buffer.from(argv.message, 'utf8'),
      tokenAmounts: [{ token: argv.token, amount }],
    },
    DEFAULTS.evmGasLimit,
  ))

const request = argv.senderProgram
  ? await sendViaSenderProgram({
      senderProgramId: argv.senderProgram,
      caller: keypair,
      destChainSelector: ETHEREUM_SEPOLIA_SELECTOR,
      params: {
        data: Buffer.from(argv.message, 'utf8'),
        tokenAmount: { token: argv.token, amount },
        feeToken: solanaFeeTokenMint(argv.feeToken),
      },
      // Always pass the script-computed values: absent flags fall back to the same defaults
      // as the direct path (env receiver, estimate + 50% gas, finalized) — never to a stale
      // stored config left by a previous send.
      configOverrides: {
        recipient: receiver,
        gasLimit,
        finality: finality ?? 'finalized',
        noExec: argv.exec === false, // false restores auto-exec after a persisted no-exec override
      },
    })
  : await chain.sendMessage({
      router: SOLANA_DEVNET.router,
      destChainSelector: ETHEREUM_SEPOLIA_SELECTOR,
      wallet: toSdkWallet(keypair),
      message: {
        receiver,
        data: Buffer.from(argv.message, 'utf8'),
        tokenAmounts: [{ token: argv.token, amount }],
        feeToken: solanaFeeTokenMint(argv.feeToken) ?? undefined,
        extraArgs: {
          gasLimit: BigInt(gasLimit),
          ...(finality !== undefined ? { finality } : {}),
          ...(argv.exec === false ? { executor: SVM_NO_EXECUTION_PUBKEY } : {}),
        },
      },
    })

printRequest(request, SOLANA_DEVNET.txUrl)
console.log(`\n💡 Track it: ${CCIP_EXPLORER_URL}${request.message.messageId}`)
