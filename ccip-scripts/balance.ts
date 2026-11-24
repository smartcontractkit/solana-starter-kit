/**
 * Chain-agnostic token balance checker: reads an SPL or ERC-20 balance for the
 * configured wallet, from the chain family and token address given on the CLI.
 *
 * Usage:
 *   npm run balance -- svm 3PjyGzj1jGVgHSKS4VR1Hr1memm63PmN8L9rtPDKwzZ6
 *   npm run balance -- svm LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L
 *   npm run balance -- evm 0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05
 *   npm run balance -- svm 3PjyGzj1jGVgHSKS4VR1Hr1memm63PmN8L9rtPDKwzZ6 --owner 2jL182LuR2qjwJffrGDzf8J21GCuYDVL2xmL8yj5teah
 */
import 'dotenv/config'

import {
  getAccount,
  getAssociatedTokenAddressSync,
  MintLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { DEFAULTS, ETHEREUM_SEPOLIA, SOLANA_DEVNET } from './utils/config.ts'
import { getEvmWallet, getSolanaWallet } from './utils/chains.ts'

const argv = await yargs(hideBin(process.argv))
  .command('$0 <family> <token>', 'Check a token balance', (y) =>
    y
      .positional('family', { choices: ['svm', 'evm'] as const, describe: 'Chain family' })
      .positional('token', { type: 'string', describe: 'Token mint (SVM) or ERC-20 address (EVM)' })
      .option('owner', {
        type: 'string',
        describe: 'Owner to check (default: the configured wallet; SVM accepts any address incl. PDAs)',
      }),
  )
  .parseAsync()

const { family, token } = argv as unknown as { family: 'svm' | 'evm'; token: string }

if (family === 'svm') {
  const connection = new Connection(SOLANA_DEVNET.rpcUrl, DEFAULTS.solanaCommitment)
  const mint = new PublicKey(token)
  const mintAccount = await connection.getAccountInfo(mint)
  if (!mintAccount) throw new Error(`Mint not found: ${mint}`)
  const tokenProgram = mintAccount.owner
  if (!tokenProgram.equals(TOKEN_PROGRAM_ID) && !tokenProgram.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error(`Not an SPL token mint (owner ${tokenProgram.toBase58()}): ${mint}`)
  }
  const decimals = MintLayout.decode(mintAccount.data).decimals
  const owner = argv.owner ? new PublicKey(argv.owner) : getSolanaWallet().publicKey
  const ata = getAssociatedTokenAddressSync(mint, owner, true, tokenProgram)
  const account = await getAccount(connection, ata, DEFAULTS.solanaCommitment, tokenProgram)
  const balance = account.amount
  console.log(`🪙  ${SOLANA_DEVNET.name} balance`)
  console.log(
    `   Token:           ${mint} (${tokenProgram.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : 'SPL Token'})`,
  )
  console.log(`   Owner:           ${owner}`)
  console.log(`   Token account:   ${ata}`)
  console.log(
    `   Balance:         ${balance} base units (${ethers.formatUnits(balance, decimals)} formatted, ${decimals} decimals)`,
  )
} else {
  const wallet = getEvmWallet()
  const erc20 = new ethers.Contract(
    token,
    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
    wallet,
  )
  const owner = argv.owner ?? wallet.address
  const [balance, decimals] = await Promise.all([
    erc20.balanceOf(owner) as Promise<bigint>,
    erc20.decimals() as Promise<number>,
  ])
  console.log(`🪙  ${ETHEREUM_SEPOLIA.name} balance`)
  console.log(`   Token:           ${token}`)
  console.log(`   Owner:           ${owner}`)
  console.log(
    `   Balance:         ${balance} base units (${ethers.formatUnits(balance, decimals)} formatted, ${decimals} decimals)`,
  )
}
