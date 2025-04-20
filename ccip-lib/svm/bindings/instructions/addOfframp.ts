import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface AddOfframpArgs {
  sourceChainSelector: BN
  offramp: PublicKey
}

export interface AddOfframpAccounts {
  allowedOfframp: PublicKey
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("sourceChainSelector"),
  borsh.publicKey("offramp"),
])

/**
 * Add an offramp address to the list of offramps allowed by the router, for a
 * particular source chain. External users will check this list before accepting
 * a `ccip_receive` CPI.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for this operation.
 * * `source_chain_selector` - The source chain for the offramp's lane.
 * * `offramp` - The offramp's address.
 */
export function addOfframp(
  args: AddOfframpArgs,
  accounts: AddOfframpAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.allowedOfframp, isSigner: false, isWritable: true },
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([164, 255, 154, 96, 204, 239, 24, 2])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      sourceChainSelector: args.sourceChainSelector,
      offramp: args.offramp,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
