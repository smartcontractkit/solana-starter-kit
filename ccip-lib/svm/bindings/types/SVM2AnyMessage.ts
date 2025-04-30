import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface SVM2AnyMessageFields {
  receiver: Uint8Array
  data: Uint8Array
  tokenAmounts: Array<types.SVMTokenAmountFields>
  feeToken: PublicKey
  extraArgs: Uint8Array
}

export interface SVM2AnyMessageJSON {
  receiver: Array<number>
  data: Array<number>
  tokenAmounts: Array<types.SVMTokenAmountJSON>
  feeToken: string
  extraArgs: Array<number>
}

export class SVM2AnyMessage {
  readonly receiver: Uint8Array
  readonly data: Uint8Array
  readonly tokenAmounts: Array<types.SVMTokenAmount>
  readonly feeToken: PublicKey
  readonly extraArgs: Uint8Array

  constructor(fields: SVM2AnyMessageFields) {
    this.receiver = fields.receiver
    this.data = fields.data
    this.tokenAmounts = fields.tokenAmounts.map(
      (item) => new types.SVMTokenAmount({ ...item })
    )
    this.feeToken = fields.feeToken
    this.extraArgs = fields.extraArgs
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.vecU8("receiver"),
        borsh.vecU8("data"),
        borsh.vec(types.SVMTokenAmount.layout(), "tokenAmounts"),
        borsh.publicKey("feeToken"),
        borsh.vecU8("extraArgs"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new SVM2AnyMessage({
      receiver: new Uint8Array(
        obj.receiver.buffer,
        obj.receiver.byteOffset,
        obj.receiver.length
      ),
      data: new Uint8Array(
        obj.data.buffer,
        obj.data.byteOffset,
        obj.data.length
      ),
      tokenAmounts: obj.tokenAmounts.map(
        (
          item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
        ) => types.SVMTokenAmount.fromDecoded(item)
      ),
      feeToken: obj.feeToken,
      extraArgs: new Uint8Array(
        obj.extraArgs.buffer,
        obj.extraArgs.byteOffset,
        obj.extraArgs.length
      ),
    })
  }

  static toEncodable(fields: SVM2AnyMessageFields) {
    return {
      receiver: Buffer.from(
        fields.receiver.buffer,
        fields.receiver.byteOffset,
        fields.receiver.length
      ),
      data: Buffer.from(
        fields.data.buffer,
        fields.data.byteOffset,
        fields.data.length
      ),
      tokenAmounts: fields.tokenAmounts.map((item) =>
        types.SVMTokenAmount.toEncodable(item)
      ),
      feeToken: fields.feeToken,
      extraArgs: Buffer.from(
        fields.extraArgs.buffer,
        fields.extraArgs.byteOffset,
        fields.extraArgs.length
      ),
    }
  }

  toJSON(): SVM2AnyMessageJSON {
    return {
      receiver: Array.from(this.receiver.values()),
      data: Array.from(this.data.values()),
      tokenAmounts: this.tokenAmounts.map((item) => item.toJSON()),
      feeToken: this.feeToken.toString(),
      extraArgs: Array.from(this.extraArgs.values()),
    }
  }

  static fromJSON(obj: SVM2AnyMessageJSON): SVM2AnyMessage {
    return new SVM2AnyMessage({
      receiver: Uint8Array.from(obj.receiver),
      data: Uint8Array.from(obj.data),
      tokenAmounts: obj.tokenAmounts.map((item) =>
        types.SVMTokenAmount.fromJSON(item)
      ),
      feeToken: new PublicKey(obj.feeToken),
      extraArgs: Uint8Array.from(obj.extraArgs),
    })
  }

  toEncodable() {
    return SVM2AnyMessage.toEncodable(this)
  }
}
