import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface RemoteAddressFields {
  address: Uint8Array
}

export interface RemoteAddressJSON {
  address: Array<number>
}

export class RemoteAddress {
  readonly address: Uint8Array

  constructor(fields: RemoteAddressFields) {
    this.address = fields.address
  }

  static layout(property?: string) {
    return borsh.struct([borsh.vecU8("address")], property)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RemoteAddress({
      address: new Uint8Array(
        obj.address.buffer,
        obj.address.byteOffset,
        obj.address.length
      ),
    })
  }

  static toEncodable(fields: RemoteAddressFields) {
    return {
      address: Buffer.from(
        fields.address.buffer,
        fields.address.byteOffset,
        fields.address.length
      ),
    }
  }

  toJSON(): RemoteAddressJSON {
    return {
      address: Array.from(this.address.values()),
    }
  }

  static fromJSON(obj: RemoteAddressJSON): RemoteAddress {
    return new RemoteAddress({
      address: Uint8Array.from(obj.address),
    })
  }

  toEncodable() {
    return RemoteAddress.toEncodable(this)
  }
}
