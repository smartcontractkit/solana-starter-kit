import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface RampMessageHeaderFields {
  messageId: Array<number>
  sourceChainSelector: BN
  destChainSelector: BN
  sequenceNumber: BN
  nonce: BN
}

export interface RampMessageHeaderJSON {
  messageId: Array<number>
  sourceChainSelector: string
  destChainSelector: string
  sequenceNumber: string
  nonce: string
}

export class RampMessageHeader {
  readonly messageId: Array<number>
  readonly sourceChainSelector: BN
  readonly destChainSelector: BN
  readonly sequenceNumber: BN
  readonly nonce: BN

  constructor(fields: RampMessageHeaderFields) {
    this.messageId = fields.messageId
    this.sourceChainSelector = fields.sourceChainSelector
    this.destChainSelector = fields.destChainSelector
    this.sequenceNumber = fields.sequenceNumber
    this.nonce = fields.nonce
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.array(borsh.u8(), 32, "messageId"),
        borsh.u64("sourceChainSelector"),
        borsh.u64("destChainSelector"),
        borsh.u64("sequenceNumber"),
        borsh.u64("nonce"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RampMessageHeader({
      messageId: obj.messageId,
      sourceChainSelector: obj.sourceChainSelector,
      destChainSelector: obj.destChainSelector,
      sequenceNumber: obj.sequenceNumber,
      nonce: obj.nonce,
    })
  }

  static toEncodable(fields: RampMessageHeaderFields) {
    return {
      messageId: fields.messageId,
      sourceChainSelector: fields.sourceChainSelector,
      destChainSelector: fields.destChainSelector,
      sequenceNumber: fields.sequenceNumber,
      nonce: fields.nonce,
    }
  }

  toJSON(): RampMessageHeaderJSON {
    return {
      messageId: this.messageId,
      sourceChainSelector: this.sourceChainSelector.toString(),
      destChainSelector: this.destChainSelector.toString(),
      sequenceNumber: this.sequenceNumber.toString(),
      nonce: this.nonce.toString(),
    }
  }

  static fromJSON(obj: RampMessageHeaderJSON): RampMessageHeader {
    return new RampMessageHeader({
      messageId: obj.messageId,
      sourceChainSelector: new BN(obj.sourceChainSelector),
      destChainSelector: new BN(obj.destChainSelector),
      sequenceNumber: new BN(obj.sequenceNumber),
      nonce: new BN(obj.nonce),
    })
  }

  toEncodable() {
    return RampMessageHeader.toEncodable(this)
  }
}
