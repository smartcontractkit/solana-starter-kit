import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface LockOrBurnOutV1Fields {
  dest_token_address: types.RemoteAddressFields
  dest_pool_data: Uint8Array
}

export interface LockOrBurnOutV1JSON {
  dest_token_address: types.RemoteAddressJSON
  dest_pool_data: Array<number>
}

export class LockOrBurnOutV1 {
  readonly dest_token_address: types.RemoteAddress
  readonly dest_pool_data: Uint8Array

  constructor(fields: LockOrBurnOutV1Fields) {
    this.dest_token_address = new types.RemoteAddress({
      ...fields.dest_token_address,
    })
    this.dest_pool_data = fields.dest_pool_data
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.RemoteAddress.layout("dest_token_address"),
        borsh.vecU8("dest_pool_data"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new LockOrBurnOutV1({
      dest_token_address: types.RemoteAddress.fromDecoded(
        obj.dest_token_address
      ),
      dest_pool_data: new Uint8Array(
        obj.dest_pool_data.buffer,
        obj.dest_pool_data.byteOffset,
        obj.dest_pool_data.length
      ),
    })
  }

  static toEncodable(fields: LockOrBurnOutV1Fields) {
    return {
      dest_token_address: types.RemoteAddress.toEncodable(
        fields.dest_token_address
      ),
      dest_pool_data: Buffer.from(
        fields.dest_pool_data.buffer,
        fields.dest_pool_data.byteOffset,
        fields.dest_pool_data.length
      ),
    }
  }

  toJSON(): LockOrBurnOutV1JSON {
    return {
      dest_token_address: this.dest_token_address.toJSON(),
      dest_pool_data: Array.from(this.dest_pool_data.values()),
    }
  }

  static fromJSON(obj: LockOrBurnOutV1JSON): LockOrBurnOutV1 {
    return new LockOrBurnOutV1({
      dest_token_address: types.RemoteAddress.fromJSON(obj.dest_token_address),
      dest_pool_data: Uint8Array.from(obj.dest_pool_data),
    })
  }

  toEncodable() {
    return LockOrBurnOutV1.toEncodable(this)
  }
}
