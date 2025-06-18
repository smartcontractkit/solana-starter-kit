import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface UpdateSvmChainSelectorArgs {
  newChainSelector: BN
}

export interface UpdateSvmChainSelectorAccounts {
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([borsh.u64("newChainSelector")])

/**
 * Updates the SVM chain selector in the router configuration.
 *
 * This method should only be used if there was an error with the initial configuration or if the solana chain selector changes.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for updating the configuration.
 * * `new_chain_selector` - The new chain selector for SVM.
 */
export function updateSvmChainSelector(
  args: UpdateSvmChainSelectorArgs,
  accounts: UpdateSvmChainSelectorAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([164, 212, 71, 101, 166, 113, 26, 93])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      newChainSelector: args.newChainSelector,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
