import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface SVM2AnyTokenTransferFields {
  sourcePoolAddress: PublicKey
  destTokenAddress: Uint8Array
  extraData: Uint8Array
  amount: types.CrossChainAmountFields
  destExecData: Uint8Array
}

export interface SVM2AnyTokenTransferJSON {
  sourcePoolAddress: string
  destTokenAddress: Array<number>
  extraData: Array<number>
  amount: types.CrossChainAmountJSON
  destExecData: Array<number>
}

export class SVM2AnyTokenTransfer {
  readonly sourcePoolAddress: PublicKey
  readonly destTokenAddress: Uint8Array
  readonly extraData: Uint8Array
  readonly amount: types.CrossChainAmount
  readonly destExecData: Uint8Array

  constructor(fields: SVM2AnyTokenTransferFields) {
    this.sourcePoolAddress = fields.sourcePoolAddress
    this.destTokenAddress = fields.destTokenAddress
    this.extraData = fields.extraData
    this.amount = new types.CrossChainAmount({ ...fields.amount })
    this.destExecData = fields.destExecData
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.publicKey("sourcePoolAddress"),
        borsh.vecU8("destTokenAddress"),
        borsh.vecU8("extraData"),
        types.CrossChainAmount.layout("amount"),
        borsh.vecU8("destExecData"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new SVM2AnyTokenTransfer({
      sourcePoolAddress: obj.sourcePoolAddress,
      destTokenAddress: new Uint8Array(
        obj.destTokenAddress.buffer,
        obj.destTokenAddress.byteOffset,
        obj.destTokenAddress.length
      ),
      extraData: new Uint8Array(
        obj.extraData.buffer,
        obj.extraData.byteOffset,
        obj.extraData.length
      ),
      amount: types.CrossChainAmount.fromDecoded(obj.amount),
      destExecData: new Uint8Array(
        obj.destExecData.buffer,
        obj.destExecData.byteOffset,
        obj.destExecData.length
      ),
    })
  }

  static toEncodable(fields: SVM2AnyTokenTransferFields) {
    return {
      sourcePoolAddress: fields.sourcePoolAddress,
      destTokenAddress: Buffer.from(
        fields.destTokenAddress.buffer,
        fields.destTokenAddress.byteOffset,
        fields.destTokenAddress.length
      ),
      extraData: Buffer.from(
        fields.extraData.buffer,
        fields.extraData.byteOffset,
        fields.extraData.length
      ),
      amount: types.CrossChainAmount.toEncodable(fields.amount),
      destExecData: Buffer.from(
        fields.destExecData.buffer,
        fields.destExecData.byteOffset,
        fields.destExecData.length
      ),
    }
  }

  toJSON(): SVM2AnyTokenTransferJSON {
    return {
      sourcePoolAddress: this.sourcePoolAddress.toString(),
      destTokenAddress: Array.from(this.destTokenAddress.values()),
      extraData: Array.from(this.extraData.values()),
      amount: this.amount.toJSON(),
      destExecData: Array.from(this.destExecData.values()),
    }
  }

  static fromJSON(obj: SVM2AnyTokenTransferJSON): SVM2AnyTokenTransfer {
    return new SVM2AnyTokenTransfer({
      sourcePoolAddress: new PublicKey(obj.sourcePoolAddress),
      destTokenAddress: Uint8Array.from(obj.destTokenAddress),
      extraData: Uint8Array.from(obj.extraData),
      amount: types.CrossChainAmount.fromJSON(obj.amount),
      destExecData: Uint8Array.from(obj.destExecData),
    })
  }

  toEncodable() {
    return SVM2AnyTokenTransfer.toEncodable(this)
  }
}
