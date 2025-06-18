import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface RollbackCcipVersionForDestChainArgs {
  destChainSelector: BN
}

export interface RollbackCcipVersionForDestChainAccounts {
  destChainState: PublicKey
  config: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([borsh.u64("destChainSelector")])

/**
 * Rolls back the CCIP version for a destination chain.
 * This effectively just restores the old version's sequence number of the destination chain state.
 * We only support 1 consecutive rollback. If a rollback has occurred for that lane, the version can't
 * be rolled back again without bumping the version first.
 *
 * # Arguments
 * * `ctx` - The context containing the accounts required for the rollback.
 * * `dest_chain_selector` - The destination chain selector to rollback the version for.
 */
export function rollbackCcipVersionForDestChain(
  args: RollbackCcipVersionForDestChainArgs,
  accounts: RollbackCcipVersionForDestChainAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.destChainState, isSigner: false, isWritable: true },
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([95, 107, 33, 138, 26, 57, 154, 110])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      destChainSelector: args.destChainSelector,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
