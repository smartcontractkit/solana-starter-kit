import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface LockOrBurnInV1Fields {
  receiver: Uint8Array
  remote_chain_selector: BN
  original_sender: PublicKey
  amount: BN
  local_token: PublicKey
}

export interface LockOrBurnInV1JSON {
  receiver: Array<number>
  remote_chain_selector: string
  original_sender: string
  amount: string
  local_token: string
}

export class LockOrBurnInV1 {
  readonly receiver: Uint8Array
  readonly remote_chain_selector: BN
  readonly original_sender: PublicKey
  readonly amount: BN
  readonly local_token: PublicKey

  constructor(fields: LockOrBurnInV1Fields) {
    this.receiver = fields.receiver
    this.remote_chain_selector = fields.remote_chain_selector
    this.original_sender = fields.original_sender
    this.amount = fields.amount
    this.local_token = fields.local_token
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.vecU8("receiver"),
        borsh.u64("remote_chain_selector"),
        borsh.publicKey("original_sender"),
        borsh.u64("amount"),
        borsh.publicKey("local_token"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new LockOrBurnInV1({
      receiver: new Uint8Array(
        obj.receiver.buffer,
        obj.receiver.byteOffset,
        obj.receiver.length
      ),
      remote_chain_selector: obj.remote_chain_selector,
      original_sender: new PublicKey(obj.original_sender),
      amount: obj.amount,
      local_token: new PublicKey(obj.local_token),
    })
  }

  static toEncodable(fields: LockOrBurnInV1Fields) {
    return {
      receiver: Buffer.from(
        fields.receiver.buffer,
        fields.receiver.byteOffset,
        fields.receiver.length
      ),
      remote_chain_selector: fields.remote_chain_selector,
      original_sender: fields.original_sender,
      amount: fields.amount,
      local_token: fields.local_token,
    }
  }

  toJSON(): LockOrBurnInV1JSON {
    return {
      receiver: Array.from(this.receiver.values()),
      remote_chain_selector: this.remote_chain_selector.toString(),
      original_sender: this.original_sender.toString(),
      amount: this.amount.toString(),
      local_token: this.local_token.toString(),
    }
  }

  static fromJSON(obj: LockOrBurnInV1JSON): LockOrBurnInV1 {
    return new LockOrBurnInV1({
      receiver: Uint8Array.from(obj.receiver),
      remote_chain_selector: new BN(obj.remote_chain_selector),
      original_sender: new PublicKey(obj.original_sender),
      amount: new BN(obj.amount),
      local_token: new PublicKey(obj.local_token),
    })
  }

  toEncodable() {
    return LockOrBurnInV1.toEncodable(this)
  }
}
