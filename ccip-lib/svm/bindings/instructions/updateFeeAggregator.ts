import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface UpdateFeeAggregatorArgs {
  feeAggregator: PublicKey
}

export interface UpdateFeeAggregatorAccounts {
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("feeAggregator")])

/**
 * Updates the fee aggregator in the router configuration.
 * The Admin is the only one able to update the fee aggregator.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for updating the configuration.
 * * `fee_aggregator` - The new fee aggregator address (ATAs will be derived for it for each token).
 */
export function updateFeeAggregator(
  args: UpdateFeeAggregatorArgs,
  accounts: UpdateFeeAggregatorAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([85, 112, 115, 60, 22, 95, 230, 56])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      feeAggregator: args.feeAggregator,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
