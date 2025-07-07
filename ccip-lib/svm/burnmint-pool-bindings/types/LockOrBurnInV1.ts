import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface LockOrBurnInV1Fields {
  receiver: Uint8Array
  remoteChainSelector: BN
  originalSender: PublicKey
  amount: BN
  localToken: PublicKey
}

export interface LockOrBurnInV1JSON {
  receiver: Array<number>
  remoteChainSelector: string
  originalSender: string
  amount: string
  localToken: string
}

export class LockOrBurnInV1 {
  readonly receiver: Uint8Array
  readonly remoteChainSelector: BN
  readonly originalSender: PublicKey
  readonly amount: BN
  readonly localToken: PublicKey

  constructor(fields: LockOrBurnInV1Fields) {
    this.receiver = fields.receiver
    this.remoteChainSelector = fields.remoteChainSelector
    this.originalSender = fields.originalSender
    this.amount = fields.amount
    this.localToken = fields.localToken
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.vecU8("receiver"),
        borsh.u64("remoteChainSelector"),
        borsh.publicKey("originalSender"),
        borsh.u64("amount"),
        borsh.publicKey("localToken"),
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
      remoteChainSelector: obj.remoteChainSelector,
      originalSender: obj.originalSender,
      amount: obj.amount,
      localToken: obj.localToken,
    })
  }

  static toEncodable(fields: LockOrBurnInV1Fields) {
    return {
      receiver: Buffer.from(
        fields.receiver.buffer,
        fields.receiver.byteOffset,
        fields.receiver.length
      ),
      remoteChainSelector: fields.remoteChainSelector,
      originalSender: fields.originalSender,
      amount: fields.amount,
      localToken: fields.localToken,
    }
  }

  toJSON(): LockOrBurnInV1JSON {
    return {
      receiver: Array.from(this.receiver.values()),
      remoteChainSelector: this.remoteChainSelector.toString(),
      originalSender: this.originalSender.toString(),
      amount: this.amount.toString(),
      localToken: this.localToken.toString(),
    }
  }

  static fromJSON(obj: LockOrBurnInV1JSON): LockOrBurnInV1 {
    return new LockOrBurnInV1({
      receiver: Uint8Array.from(obj.receiver),
      remoteChainSelector: new BN(obj.remoteChainSelector),
      originalSender: new PublicKey(obj.originalSender),
      amount: new BN(obj.amount),
      localToken: new PublicKey(obj.localToken),
    })
  }

  toEncodable() {
    return LockOrBurnInV1.toEncodable(this)
  }
}
