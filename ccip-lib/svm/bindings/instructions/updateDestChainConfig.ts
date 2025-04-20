import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface UpdateDestChainConfigArgs {
  destChainSelector: BN
  destChainConfig: types.DestChainConfigFields
}

export interface UpdateDestChainConfigAccounts {
  destChainState: PublicKey
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("destChainSelector"),
  types.DestChainConfig.layout("destChainConfig"),
])

/**
 * Updates the configuration of the destination chain selector.
 *
 * The Admin is the only one able to update the destination chain config.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for updating the chain selector.
 * * `dest_chain_selector` - The destination chain selector to be updated.
 * * `dest_chain_config` - The new configuration for the destination chain.
 */
export function updateDestChainConfig(
  args: UpdateDestChainConfigArgs,
  accounts: UpdateDestChainConfigAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.destChainState, isSigner: false, isWritable: true },
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([215, 122, 81, 22, 190, 58, 219, 13])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      destChainSelector: args.destChainSelector,
      destChainConfig: types.DestChainConfig.toEncodable(args.destChainConfig),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
