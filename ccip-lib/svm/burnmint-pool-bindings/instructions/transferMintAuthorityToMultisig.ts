import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface TransferMintAuthorityToMultisigAccounts {
  state: PublicKey
  mint: PublicKey
  tokenProgram: PublicKey
  poolSigner: PublicKey
  authority: PublicKey
  newMultisigMintAuthority: PublicKey
  program: PublicKey
  programData: PublicKey
}

export function transferMintAuthorityToMultisig(
  accounts: TransferMintAuthorityToMultisigAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.poolSigner, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    {
      pubkey: accounts.newMultisigMintAuthority,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.programData, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([229, 13, 219, 109, 252, 176, 138, 118])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
