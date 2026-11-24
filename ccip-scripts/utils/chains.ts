/**
 * Chain and wallet construction for the ccip-sdk, plus shared output helpers.
 */
import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  EVMChain,
  SolanaChain,
  estimateReceiveExecution,
  resolveTokenDecimals,
  type CCIPRequest,
  type FinalityRequested,
  type Logger,
} from '@chainlink/ccip-sdk'
import { Keypair, VersionedTransaction } from '@solana/web3.js'
import { ethers, parseUnits } from 'ethers'

import { DEFAULTS, ETHEREUM_SEPOLIA, SOLANA_DEVNET, requireEnv } from './config.ts'

/** Solana wallet from the standard CLI keypair location (or SOLANA_WALLET_PATH). */
export function getSolanaWallet(): Keypair {
  const path = process.env.SOLANA_WALLET_PATH ?? join(homedir(), '.config', 'solana', 'id.json')
  const secret = JSON.parse(readFileSync(path, 'utf-8')) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

/** Structural match for the SDK's Solana wallet interface (publicKey + signTransaction). */
export interface SolanaSdkWallet {
  publicKey: Keypair['publicKey']
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
}

/** Anchor-compatible wallet wrapper for the SDK. */
export function toSdkWallet(keypair: Keypair): SolanaSdkWallet {
  return {
    publicKey: keypair.publicKey,
    async signTransaction(tx: VersionedTransaction) {
      tx.sign([keypair])
      return tx
    },
  }
}

/** EVM wallet from EVM_PRIVATE_KEY, connected to Sepolia. */
export function getEvmWallet(): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(ETHEREUM_SEPOLIA.rpcUrl)
  return new ethers.Wallet(requireEnv('EVM_PRIVATE_KEY'), provider)
}

/**
 * The SDK's default logger is `console`, which prints every debug-level trace — full
 * "Simulation results: {…}" dumps and a "fetched 200 {…}" line per RPC call — burying
 * the scripts' own output. Drop `debug` (the noise) and keep `info`/`warn`/`error`
 * (retry exhaustion, decode failures, cleanup notices). Set `DEBUG_CCIP_SDK=1` to
 * see everything again.
 */
export const QUIET_SDK_LOGGER: Logger = process.env.DEBUG_CCIP_SDK
  ? console
  : { debug: () => {}, info: console.info, warn: console.warn, error: console.error }

/**
 * The SDK's built-in rate-limit wrapper backs off with an UNREF'd timer, so when a
 * 429 backoff against a public RPC endpoint is the only pending work, Node's event
 * loop drains and kills the process mid-await ("unsettled top-level await"). Token
 * sends trip this easily: their pre-send simulations burst dozens of RPC calls.
 * This replacement keeps the same retry semantics but with a REF'd timer, so the
 * process stays alive through the backoff.
 */
export function retryFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const maxRetries = 10
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) // ref'd: keeps the loop alive
  const attempt = async (n: number): Promise<Response> => {
    try {
      const response = await fetch(input, init)
      if (response.status === 429 || response.status === 503) {
        if (n >= maxRetries) return response
        const retryAfter = Number(response.headers.get('retry-after') ?? 0)
        await sleep(Math.max(retryAfter * 1000, Math.min(30_000, 500 * 2 ** n)))
        return attempt(n + 1)
      }
      return response
    } catch (err) {
      if (n >= maxRetries) throw err
      await sleep(Math.min(30_000, 500 * 2 ** n))
      return attempt(n + 1)
    }
  }
  return attempt(0)
}

export async function getSolanaChain(): Promise<SolanaChain> {
  return SolanaChain.fromUrl(SOLANA_DEVNET.rpcUrl, { logger: QUIET_SDK_LOGGER, fetch: retryFetch })
}

export async function getEvmChain(): Promise<EVMChain> {
  return EVMChain.fromUrl(ETHEREUM_SEPOLIA.rpcUrl, { logger: QUIET_SDK_LOGGER, fetch: retryFetch })
}

/**
 * Estimate the gas limit the destination receiver needs, via the SDK's
 * `estimateReceiveExecution` (simulates the actual destination execution).
 * Returns the estimate with a 50% safety margin (simulations are state-dependent:
 * a first-ever storage write costs far more than the steady state), or the
 * fallback default when estimation is unavailable (e.g. SVM v2 receivers,
 * which the SDK's estimator does not yet model).
 *
 * A 0 estimate is returned as 0: it means no receiver callback is needed
 * (token-only send). CCIP 2.0 treats `data.length == 0 && gasLimit == 0` as the
 * token-only fast path — the OffRamp skips the receiver call entirely and only
 * requires pool CCVs. Forcing a non-zero gasLimit there makes the executor
 * attempt a receiver call it has not budgeted gas for (NotEnoughGasForCall).
 */
export async function estimateGasLimit(
  source: SolanaChain | EVMChain,
  dest: SolanaChain | EVMChain,
  router: string,
  message: Parameters<typeof estimateReceiveExecution>[0]['message'] & {
    /** SVM data+token estimates require the token receiver here (the SDK reads extraArgs, not top-level). */
    extraArgs?: { tokenReceiver?: string }
  },
  fallback: number,
): Promise<number> {
  try {
    const estimated = await estimateReceiveExecution({ source, dest, routerOrRamp: router, message })
    if (estimated > 0) {
      const withMargin = Math.ceil((estimated * 3) / 2)
      console.log(`   Gas estimate:    ${estimated} → using ${withMargin} (est. + 50% margin)`)
      return withMargin
    }
    console.log('   Gas estimate:    0 (token-only, no receiver callback)')
    return 0
  } catch (err) {
    console.log(
      `   Gas estimate:    unavailable (${(err as Error).message.split('\n')[0].slice(0, 80)}), using ${fallback}`,
    )
    return fallback
  }
}

/**
 * Convert a human-readable token amount (e.g. "1.5") to base units, resolving the
 * token's decimals on-chain (ERC-20 `decimals()` / SPL mint layout) — the same
 * `resolveTokenDecimals` chain ccip-cli uses. Returns the base-unit amount and the
 * resolved decimals (for display).
 */
export async function parseTokenAmount(
  chain: SolanaChain | EVMChain,
  token: string,
  amount: string,
): Promise<{ amount: bigint; decimals: number }> {
  const decimals = await resolveTokenDecimals(chain, token, undefined, { familyDefault: false })
  return { amount: parseUnits(amount, decimals), decimals }
}

/** Human-readable description of a requested finality. */
export function describeFinality(finality: FinalityRequested): string {
  return finality === 'finalized'
    ? 'finalized (wait for full finality)'
    : finality === 'safe'
      ? 'safe (wait for safe head)'
      : `block depth ${finality} (Faster-Than-Finality)`
}

/** Print a sent CCIP request the same way in every script. */
export function printRequest(request: CCIPRequest, txUrl: (hash: string) => string): void {
  console.log('\n✅ Message sent')
  console.log(`   Message ID:      ${request.message.messageId}`)
  console.log(`   Source tx:       ${txUrl(request.log.transactionHash)}`)
  console.log(`   Fee paid:        ${'feeTokenAmount' in request.message ? request.message.feeTokenAmount : 'n/a'}`)
  console.log(`   Dest selector:   ${request.lane.destChainSelector}`)
}
