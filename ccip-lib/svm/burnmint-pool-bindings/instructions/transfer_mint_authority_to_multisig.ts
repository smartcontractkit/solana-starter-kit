import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Transfer_mint_authority_to_multisigAccounts {
  state: PublicKey
  mint: PublicKey
  token_program: PublicKey
  pool_signer: PublicKey
  authority: PublicKey
  new_multisig_mint_authority: PublicKey
  program: PublicKey
  program_data: PublicKey
}

export function transfer_mint_authority_to_multisig(
  accounts: Transfer_mint_authority_to_multisigAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.token_program, isSigner: false, isWritable: false },
    { pubkey: accounts.pool_signer, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    {
      pubkey: accounts.new_multisig_mint_authority,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.program_data, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([229, 13, 219, 109, 252, 176, 138, 118])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
