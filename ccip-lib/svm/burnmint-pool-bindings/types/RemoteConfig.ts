import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface RemoteConfigFields {
  pool_addresses: Array<types.RemoteAddressFields>
  token_address: types.RemoteAddressFields
  decimals: number
}

export interface RemoteConfigJSON {
  pool_addresses: Array<types.RemoteAddressJSON>
  token_address: types.RemoteAddressJSON
  decimals: number
}

export class RemoteConfig {
  readonly pool_addresses: Array<types.RemoteAddress>
  readonly token_address: types.RemoteAddress
  readonly decimals: number

  constructor(fields: RemoteConfigFields) {
    this.pool_addresses = fields.pool_addresses.map(
      (item) => new types.RemoteAddress({ ...item })
    )
    this.token_address = new types.RemoteAddress({ ...fields.token_address })
    this.decimals = fields.decimals
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.vec(types.RemoteAddress.layout(), "pool_addresses"),
        types.RemoteAddress.layout("token_address"),
        borsh.u8("decimals"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RemoteConfig({
      pool_addresses: obj.pool_addresses.map(
        (
          item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
        ) => types.RemoteAddress.fromDecoded(item)
      ),
      token_address: types.RemoteAddress.fromDecoded(obj.token_address),
      decimals: obj.decimals,
    })
  }

  static toEncodable(fields: RemoteConfigFields) {
    return {
      pool_addresses: fields.pool_addresses.map((item) =>
        types.RemoteAddress.toEncodable(item)
      ),
      token_address: types.RemoteAddress.toEncodable(fields.token_address),
      decimals: fields.decimals,
    }
  }

  toJSON(): RemoteConfigJSON {
    return {
      pool_addresses: this.pool_addresses.map((item) => item.toJSON()),
      token_address: this.token_address.toJSON(),
      decimals: this.decimals,
    }
  }

  static fromJSON(obj: RemoteConfigJSON): RemoteConfig {
    return new RemoteConfig({
      pool_addresses: obj.pool_addresses.map((item) =>
        types.RemoteAddress.fromJSON(item)
      ),
      token_address: types.RemoteAddress.fromJSON(obj.token_address),
      decimals: obj.decimals,
    })
  }

  toEncodable() {
    return RemoteConfig.toEncodable(this)
  }
}
