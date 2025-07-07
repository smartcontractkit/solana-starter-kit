import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface RemoteConfigFields {
  poolAddresses: Array<types.RemoteAddressFields>
  tokenAddress: types.RemoteAddressFields
  decimals: number
}

export interface RemoteConfigJSON {
  poolAddresses: Array<types.RemoteAddressJSON>
  tokenAddress: types.RemoteAddressJSON
  decimals: number
}

export class RemoteConfig {
  readonly poolAddresses: Array<types.RemoteAddress>
  readonly tokenAddress: types.RemoteAddress
  readonly decimals: number

  constructor(fields: RemoteConfigFields) {
    this.poolAddresses = fields.poolAddresses.map(
      (item) => new types.RemoteAddress({ ...item })
    )
    this.tokenAddress = new types.RemoteAddress({ ...fields.tokenAddress })
    this.decimals = fields.decimals
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.vec(types.RemoteAddress.layout(), "poolAddresses"),
        types.RemoteAddress.layout("tokenAddress"),
        borsh.u8("decimals"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RemoteConfig({
      poolAddresses: obj.poolAddresses.map(
        (
          item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
        ) => types.RemoteAddress.fromDecoded(item)
      ),
      tokenAddress: types.RemoteAddress.fromDecoded(obj.tokenAddress),
      decimals: obj.decimals,
    })
  }

  static toEncodable(fields: RemoteConfigFields) {
    return {
      poolAddresses: fields.poolAddresses.map((item) =>
        types.RemoteAddress.toEncodable(item)
      ),
      tokenAddress: types.RemoteAddress.toEncodable(fields.tokenAddress),
      decimals: fields.decimals,
    }
  }

  toJSON(): RemoteConfigJSON {
    return {
      poolAddresses: this.poolAddresses.map((item) => item.toJSON()),
      tokenAddress: this.tokenAddress.toJSON(),
      decimals: this.decimals,
    }
  }

  static fromJSON(obj: RemoteConfigJSON): RemoteConfig {
    return new RemoteConfig({
      poolAddresses: obj.poolAddresses.map((item) =>
        types.RemoteAddress.fromJSON(item)
      ),
      tokenAddress: types.RemoteAddress.fromJSON(obj.tokenAddress),
      decimals: obj.decimals,
    })
  }

  toEncodable() {
    return RemoteConfig.toEncodable(this)
  }
}
