import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface SetDefaultCodeVersionArgs {
  codeVersion: types.CodeVersionKind
}

export interface SetDefaultCodeVersionAccounts {
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([types.CodeVersion.layout("codeVersion")])

/**
 * Config //
 * Sets the default code version to be used. This is then used by the slim routing layer to determine
 * which version of the versioned business logic module (`instructions`) to use. Only the admin may set this.
 *
 * Shared func signature with other programs
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for updating the configuration.
 * * `code_version` - The new code version to be set as default.
 */
export function setDefaultCodeVersion(
  args: SetDefaultCodeVersionArgs,
  accounts: SetDefaultCodeVersionAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([47, 151, 233, 254, 121, 82, 206, 152])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      codeVersion: args.codeVersion.toEncodable(),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
