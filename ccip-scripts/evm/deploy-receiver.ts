/**
 * Deploy the BasicCCIPReceiver contract to Ethereum Sepolia.
 *
 * Usage:
 *   npm run evm:receiver:deploy
 *
 * Prints the deployed address; set it as EVM_RECEIVER_ADDRESS in .env.
 */
import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ethers } from 'ethers'

import { ETHEREUM_SEPOLIA } from '../utils/config.ts'
import { getEvmWallet } from '../utils/chains.ts'

const here = dirname(fileURLToPath(import.meta.url))
const artifact = JSON.parse(
  readFileSync(join(here, '..', '..', 'contracts', 'evm', 'BasicCCIPReceiver.json'), 'utf-8'),
) as {
  abi: ethers.InterfaceAbi
  bytecode: string
}

const wallet = getEvmWallet()

console.log('🚀 Deploying BasicCCIPReceiver to Ethereum Sepolia')
console.log(`   Deployer:        ${await wallet.getAddress()}`)
console.log(`   Router:          ${ETHEREUM_SEPOLIA.router}`)

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)
const contract = await factory.deploy(ETHEREUM_SEPOLIA.router)
await contract.waitForDeployment()

const address = await contract.getAddress()
console.log(`\n✅ Deployed at: ${address}`)
console.log(`   Explorer: ${ETHEREUM_SEPOLIA.explorerUrl.replace('/tx/', '/address/')}${address}`)
console.log('\n💡 Add to .env:')
console.log(`   EVM_RECEIVER_ADDRESS=${address}`)
