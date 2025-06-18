import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface LockOrBurnOutV1Fields {
  destTokenAddress: types.RemoteAddressFields
  destPoolData: Uint8Array
}

export interface LockOrBurnOutV1JSON {
  destTokenAddress: types.RemoteAddressJSON
  destPoolData: Array<number>
}

export class LockOrBurnOutV1 {
  readonly destTokenAddress: types.RemoteAddress
  readonly destPoolData: Uint8Array

  constructor(fields: LockOrBurnOutV1Fields) {
    this.destTokenAddress = new types.RemoteAddress({
      ...fields.destTokenAddress,
    })
    this.destPoolData = fields.destPoolData
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.RemoteAddress.layout("destTokenAddress"),
        borsh.vecU8("destPoolData"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new LockOrBurnOutV1({
      destTokenAddress: types.RemoteAddress.fromDecoded(obj.destTokenAddress),
      destPoolData: new Uint8Array(
        obj.destPoolData.buffer,
        obj.destPoolData.byteOffset,
        obj.destPoolData.length
      ),
    })
  }

  static toEncodable(fields: LockOrBurnOutV1Fields) {
    return {
      destTokenAddress: types.RemoteAddress.toEncodable(
        fields.destTokenAddress
      ),
      destPoolData: Buffer.from(
        fields.destPoolData.buffer,
        fields.destPoolData.byteOffset,
        fields.destPoolData.length
      ),
    }
  }

  toJSON(): LockOrBurnOutV1JSON {
    return {
      destTokenAddress: this.destTokenAddress.toJSON(),
      destPoolData: Array.from(this.destPoolData.values()),
    }
  }

  static fromJSON(obj: LockOrBurnOutV1JSON): LockOrBurnOutV1 {
    return new LockOrBurnOutV1({
      destTokenAddress: types.RemoteAddress.fromJSON(obj.destTokenAddress),
      destPoolData: Uint8Array.from(obj.destPoolData),
    })
  }

  toEncodable() {
    return LockOrBurnOutV1.toEncodable(this)
  }
}
