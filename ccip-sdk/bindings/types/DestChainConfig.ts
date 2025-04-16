import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface DestChainConfigFields {
  laneCodeVersion: types.CodeVersionKind
  allowedSenders: Array<PublicKey>
  allowListEnabled: boolean
}

export interface DestChainConfigJSON {
  laneCodeVersion: types.CodeVersionJSON
  allowedSenders: Array<string>
  allowListEnabled: boolean
}

export class DestChainConfig {
  readonly laneCodeVersion: types.CodeVersionKind
  readonly allowedSenders: Array<PublicKey>
  readonly allowListEnabled: boolean

  constructor(fields: DestChainConfigFields) {
    this.laneCodeVersion = fields.laneCodeVersion
    this.allowedSenders = fields.allowedSenders
    this.allowListEnabled = fields.allowListEnabled
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.CodeVersion.layout("laneCodeVersion"),
        borsh.vec(borsh.publicKey(), "allowedSenders"),
        borsh.bool("allowListEnabled"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new DestChainConfig({
      laneCodeVersion: types.CodeVersion.fromDecoded(obj.laneCodeVersion),
      allowedSenders: obj.allowedSenders,
      allowListEnabled: obj.allowListEnabled,
    })
  }

  static toEncodable(fields: DestChainConfigFields) {
    return {
      laneCodeVersion: fields.laneCodeVersion.toEncodable(),
      allowedSenders: fields.allowedSenders,
      allowListEnabled: fields.allowListEnabled,
    }
  }

  toJSON(): DestChainConfigJSON {
    return {
      laneCodeVersion: this.laneCodeVersion.toJSON(),
      allowedSenders: this.allowedSenders.map((item) => item.toString()),
      allowListEnabled: this.allowListEnabled,
    }
  }

  static fromJSON(obj: DestChainConfigJSON): DestChainConfig {
    return new DestChainConfig({
      laneCodeVersion: types.CodeVersion.fromJSON(obj.laneCodeVersion),
      allowedSenders: obj.allowedSenders.map((item) => new PublicKey(item)),
      allowListEnabled: obj.allowListEnabled,
    })
  }

  toEncodable() {
    return DestChainConfig.toEncodable(this)
  }
}
