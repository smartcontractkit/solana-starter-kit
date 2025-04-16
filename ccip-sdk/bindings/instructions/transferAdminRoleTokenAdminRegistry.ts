import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface TransferAdminRoleTokenAdminRegistryArgs {
  newAdmin: PublicKey
}

export interface TransferAdminRoleTokenAdminRegistryAccounts {
  config: PublicKey
  tokenAdminRegistry: PublicKey
  mint: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("newAdmin")])

/**
 * Transfers the admin role of the token admin registry to a new admin.
 *
 * Only the Admin can transfer the Admin Role of the Token Admin Registry, this setups the Pending Admin and then it's their responsibility to accept the role.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for the transfer.
 * * `mint` - The public key of the token mint.
 * * `new_admin` - The public key of the new admin.
 */
export function transferAdminRoleTokenAdminRegistry(
  args: TransferAdminRoleTokenAdminRegistryArgs,
  accounts: TransferAdminRoleTokenAdminRegistryAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.tokenAdminRegistry, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([178, 98, 203, 181, 203, 107, 106, 14])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      newAdmin: args.newAdmin,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
