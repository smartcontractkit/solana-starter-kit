import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface GetFeeArgs {
  destChainSelector: BN
  message: types.SVM2AnyMessageFields
}

export interface GetFeeAccounts {
  config: PublicKey
  destChainState: PublicKey
  feeQuoter: PublicKey
  feeQuoterConfig: PublicKey
  feeQuoterDestChain: PublicKey
  feeQuoterBillingTokenConfig: PublicKey
  feeQuoterLinkTokenConfig: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("destChainSelector"),
  types.SVM2AnyMessage.layout("message"),
])

/**
 * Queries the onramp for the fee required to send a message.
 *
 * This call is permissionless. Note it does not verify whether there's a curse active
 * in order to avoid the RMN CPI overhead.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for obtaining the message fee.
 * * `dest_chain_selector` - The chain selector for the destination chain.
 * * `message` - The message to be sent. The size limit of data is 256 bytes.
 */
export function getFee(
  args: GetFeeArgs,
  accounts: GetFeeAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.destChainState, isSigner: false, isWritable: false },
    { pubkey: accounts.feeQuoter, isSigner: false, isWritable: false },
    { pubkey: accounts.feeQuoterConfig, isSigner: false, isWritable: false },
    { pubkey: accounts.feeQuoterDestChain, isSigner: false, isWritable: false },
    {
      pubkey: accounts.feeQuoterBillingTokenConfig,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: accounts.feeQuoterLinkTokenConfig,
      isSigner: false,
      isWritable: false,
    },
  ]
  const identifier = Buffer.from([115, 195, 235, 161, 25, 219, 60, 29])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      destChainSelector: args.destChainSelector,
      message: types.SVM2AnyMessage.toEncodable(args.message),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
