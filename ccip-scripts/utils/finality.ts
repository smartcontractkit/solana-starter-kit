/**
 * Shared yargs options for CCIP 2.0 features: finality (FTF) and manual execution.
 */
import type { FinalityRequested } from '@chainlink/ccip-sdk'
import type { Argv } from 'yargs'

/** SVM FinalityConfig flag: accept messages tagged safe (FCR). */
export const SVM_FINALITY_SAFE_FLAG = 0x0001

/** Parse a --finality value: 'finalized', 'safe', or a block depth 1..65535. */
export function parseFinality(value: string | undefined): FinalityRequested | undefined {
  if (value === undefined) return undefined
  if (value === 'finalized' || value === 'safe') return value
  const depth = Number(value)
  if (!Number.isInteger(depth) || depth < 1 || depth > 65535) {
    throw new Error(`Invalid --finality "${value}": use 'finalized', 'safe', or a block depth 1..65535`)
  }
  return depth
}

/** Add the shared CCIP 2.0 options to a yargs command. */
export function ccipOptions<T>(yargs: Argv<T>): Argv<T & { finality?: string; noExec?: boolean }> {
  return (
    yargs
      .option('finality', {
        type: 'string',
        describe:
          "Requested finality: 'finalized' (default), 'safe', or a block depth 1..65535 for Faster-Than-Finality",
      })
      // Declared as `exec` (default true): yargs parses `--no-exec` as its negation.
      // Declaring `no-exec` directly does NOT work — yargs maps `--no-exec` onto `exec`.
      .option('exec', {
        type: 'boolean',
        default: true,
        describe: 'Skip automated execution on the destination with --no-exec (manual execute later)',
      }) as Argv<T & { finality?: string; noExec?: boolean }>
  )
}
