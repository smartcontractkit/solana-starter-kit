import {
  TransactionInstruction,
  PublicKey,
  AccountMeta,
} from "@solana/web3.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId";

export interface CcipSendArgs {
  destChainSelector: BN;
  message: types.SVM2AnyMessageFields;
  tokenIndexes: Uint8Array;
}

export interface CcipSendAccounts {
  config: PublicKey;
  destChainState: PublicKey;
  nonce: PublicKey;
  authority: PublicKey;
  systemProgram: PublicKey;
  feeTokenProgram: PublicKey;
  feeTokenMint: PublicKey;
  /** If paying with native SOL, this must be the zero address. */
  feeTokenUserAssociatedAccount: PublicKey;
  feeTokenReceiver: PublicKey;
  feeBillingSigner: PublicKey;
  feeQuoter: PublicKey;
  feeQuoterConfig: PublicKey;
  feeQuoterDestChain: PublicKey;
  feeQuoterBillingTokenConfig: PublicKey;
  feeQuoterLinkTokenConfig: PublicKey;
  rmnRemote: PublicKey;
  rmnRemoteCurses: PublicKey;
  rmnRemoteConfig: PublicKey;
}

export const layout = borsh.struct([
  borsh.u64("destChainSelector"),
  types.SVM2AnyMessage.layout("message"),
  borsh.vecU8("tokenIndexes"),
]);

/**
 * On Ramp Flow //
 * Sends a message to the destination chain.
 *
 * Request a message to be sent to the destination chain.
 * The method name needs to be ccip_send with Anchor encoding.
 * This function is called by the CCIP Sender Contract (or final user) to send a message to the CCIP Router.
 * The message will be sent to the receiver on the destination chain selector.
 * This message emits the event CCIPMessageSent with all the necessary data to be retrieved by the OffChain Code
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for sending the message.
 * * `dest_chain_selector` - The chain selector for the destination chain.
 * * `message` - The message to be sent. The size limit of data is 256 bytes.
 * * `token_indexes` - Indices into the remaining accounts vector where the subslice for a token begins.
 */
export function ccipSend(
  args: CcipSendArgs,
  accounts: CcipSendAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.destChainState, isSigner: false, isWritable: true },
    { pubkey: accounts.nonce, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.feeTokenProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.feeTokenMint, isSigner: false, isWritable: false },
    {
      pubkey: accounts.feeTokenUserAssociatedAccount,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: accounts.feeTokenReceiver, isSigner: false, isWritable: true },
    { pubkey: accounts.feeBillingSigner, isSigner: false, isWritable: false },
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
    { pubkey: accounts.rmnRemote, isSigner: false, isWritable: false },
    { pubkey: accounts.rmnRemoteCurses, isSigner: false, isWritable: false },
    { pubkey: accounts.rmnRemoteConfig, isSigner: false, isWritable: false },
  ];
  const identifier = Buffer.from([108, 216, 134, 191, 249, 234, 33, 84]);
  const buffer = Buffer.alloc(1000);
  const len = layout.encode(
    {
      destChainSelector: args.destChainSelector,
      message: types.SVM2AnyMessage.toEncodable(args.message),
      tokenIndexes: Buffer.from(
        args.tokenIndexes.buffer,
        args.tokenIndexes.byteOffset,
        args.tokenIndexes.length
      ),
    },
    buffer
  );
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len);
  const ix = new TransactionInstruction({ keys, programId, data });
  return ix;
}
