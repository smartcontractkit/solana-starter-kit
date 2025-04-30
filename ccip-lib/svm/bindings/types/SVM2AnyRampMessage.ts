import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface SVM2AnyRampMessageFields {
  header: types.RampMessageHeaderFields
  sender: PublicKey
  data: Uint8Array
  receiver: Uint8Array
  extraArgs: Uint8Array
  feeToken: PublicKey
  tokenAmounts: Array<types.SVM2AnyTokenTransferFields>
  feeTokenAmount: types.CrossChainAmountFields
  feeValueJuels: types.CrossChainAmountFields
}

export interface SVM2AnyRampMessageJSON {
  header: types.RampMessageHeaderJSON
  sender: string
  data: Array<number>
  receiver: Array<number>
  extraArgs: Array<number>
  feeToken: string
  tokenAmounts: Array<types.SVM2AnyTokenTransferJSON>
  feeTokenAmount: types.CrossChainAmountJSON
  feeValueJuels: types.CrossChainAmountJSON
}

export class SVM2AnyRampMessage {
  readonly header: types.RampMessageHeader
  readonly sender: PublicKey
  readonly data: Uint8Array
  readonly receiver: Uint8Array
  readonly extraArgs: Uint8Array
  readonly feeToken: PublicKey
  readonly tokenAmounts: Array<types.SVM2AnyTokenTransfer>
  readonly feeTokenAmount: types.CrossChainAmount
  readonly feeValueJuels: types.CrossChainAmount

  constructor(fields: SVM2AnyRampMessageFields) {
    this.header = new types.RampMessageHeader({ ...fields.header })
    this.sender = fields.sender
    this.data = fields.data
    this.receiver = fields.receiver
    this.extraArgs = fields.extraArgs
    this.feeToken = fields.feeToken
    this.tokenAmounts = fields.tokenAmounts.map(
      (item) => new types.SVM2AnyTokenTransfer({ ...item })
    )
    this.feeTokenAmount = new types.CrossChainAmount({
      ...fields.feeTokenAmount,
    })
    this.feeValueJuels = new types.CrossChainAmount({ ...fields.feeValueJuels })
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.RampMessageHeader.layout("header"),
        borsh.publicKey("sender"),
        borsh.vecU8("data"),
        borsh.vecU8("receiver"),
        borsh.vecU8("extraArgs"),
        borsh.publicKey("feeToken"),
        borsh.vec(types.SVM2AnyTokenTransfer.layout(), "tokenAmounts"),
        types.CrossChainAmount.layout("feeTokenAmount"),
        types.CrossChainAmount.layout("feeValueJuels"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new SVM2AnyRampMessage({
      header: types.RampMessageHeader.fromDecoded(obj.header),
      sender: obj.sender,
      data: new Uint8Array(
        obj.data.buffer,
        obj.data.byteOffset,
        obj.data.length
      ),
      receiver: new Uint8Array(
        obj.receiver.buffer,
        obj.receiver.byteOffset,
        obj.receiver.length
      ),
      extraArgs: new Uint8Array(
        obj.extraArgs.buffer,
        obj.extraArgs.byteOffset,
        obj.extraArgs.length
      ),
      feeToken: obj.feeToken,
      tokenAmounts: obj.tokenAmounts.map(
        (
          item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
        ) => types.SVM2AnyTokenTransfer.fromDecoded(item)
      ),
      feeTokenAmount: types.CrossChainAmount.fromDecoded(obj.feeTokenAmount),
      feeValueJuels: types.CrossChainAmount.fromDecoded(obj.feeValueJuels),
    })
  }

  static toEncodable(fields: SVM2AnyRampMessageFields) {
    return {
      header: types.RampMessageHeader.toEncodable(fields.header),
      sender: fields.sender,
      data: Buffer.from(
        fields.data.buffer,
        fields.data.byteOffset,
        fields.data.length
      ),
      receiver: Buffer.from(
        fields.receiver.buffer,
        fields.receiver.byteOffset,
        fields.receiver.length
      ),
      extraArgs: Buffer.from(
        fields.extraArgs.buffer,
        fields.extraArgs.byteOffset,
        fields.extraArgs.length
      ),
      feeToken: fields.feeToken,
      tokenAmounts: fields.tokenAmounts.map((item) =>
        types.SVM2AnyTokenTransfer.toEncodable(item)
      ),
      feeTokenAmount: types.CrossChainAmount.toEncodable(fields.feeTokenAmount),
      feeValueJuels: types.CrossChainAmount.toEncodable(fields.feeValueJuels),
    }
  }

  toJSON(): SVM2AnyRampMessageJSON {
    return {
      header: this.header.toJSON(),
      sender: this.sender.toString(),
      data: Array.from(this.data.values()),
      receiver: Array.from(this.receiver.values()),
      extraArgs: Array.from(this.extraArgs.values()),
      feeToken: this.feeToken.toString(),
      tokenAmounts: this.tokenAmounts.map((item) => item.toJSON()),
      feeTokenAmount: this.feeTokenAmount.toJSON(),
      feeValueJuels: this.feeValueJuels.toJSON(),
    }
  }

  static fromJSON(obj: SVM2AnyRampMessageJSON): SVM2AnyRampMessage {
    return new SVM2AnyRampMessage({
      header: types.RampMessageHeader.fromJSON(obj.header),
      sender: new PublicKey(obj.sender),
      data: Uint8Array.from(obj.data),
      receiver: Uint8Array.from(obj.receiver),
      extraArgs: Uint8Array.from(obj.extraArgs),
      feeToken: new PublicKey(obj.feeToken),
      tokenAmounts: obj.tokenAmounts.map((item) =>
        types.SVM2AnyTokenTransfer.fromJSON(item)
      ),
      feeTokenAmount: types.CrossChainAmount.fromJSON(obj.feeTokenAmount),
      feeValueJuels: types.CrossChainAmount.fromJSON(obj.feeValueJuels),
    })
  }

  toEncodable() {
    return SVM2AnyRampMessage.toEncodable(this)
  }
}
