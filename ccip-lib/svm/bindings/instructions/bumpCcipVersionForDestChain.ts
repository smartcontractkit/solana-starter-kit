import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface BumpCcipVersionForDestChainArgs {
  destChainSelector: BN
}

export interface BumpCcipVersionForDestChainAccounts {
  destChainState: PublicKey
  config: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([borsh.u64("destChainSelector")])

/**
 * Bumps the CCIP version for a destination chain.
 * This effectively just resets the sequence number of the destination chain state.
 * If there had been a previous rollback, on re-upgrade the sequence number will resume from where it was
 * prior to the rollback.
 *
 * # Arguments
 * * `ctx` - The context containing the accounts required for the bump.
 * * `dest_chain_selector` - The destination chain selector to bump version for.
 */
export function bumpCcipVersionForDestChain(
  args: BumpCcipVersionForDestChainArgs,
  accounts: BumpCcipVersionForDestChainAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.destChainState, isSigner: false, isWritable: true },
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([120, 25, 6, 201, 42, 224, 235, 187])
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
