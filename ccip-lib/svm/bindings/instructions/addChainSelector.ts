import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface AddChainSelectorArgs {
  newChainSelector: BN
  destChainConfig: types.DestChainConfigFields
}

export interface AddChainSelectorAccounts {
  destChainState: PublicKey
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("newChainSelector"),
  types.DestChainConfig.layout("destChainConfig"),
])

/**
 * Adds a new chain selector to the router.
 *
 * The Admin needs to add any new chain supported (this means both OnRamp and OffRamp).
 * When adding a new chain, the Admin needs to specify if it's enabled or not.
 * They may enable only source, or only destination, or neither, or both.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for adding the chain selector.
 * * `new_chain_selector` - The new chain selector to be added.
 * * `source_chain_config` - The configuration for the chain as source.
 * * `dest_chain_config` - The configuration for the chain as destination.
 */
export function addChainSelector(
  args: AddChainSelectorArgs,
  accounts: AddChainSelectorAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.destChainState, isSigner: false, isWritable: true },
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([28, 60, 171, 0, 195, 113, 56, 7])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      newChainSelector: args.newChainSelector,
      destChainConfig: types.DestChainConfig.toEncodable(args.destChainConfig),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
