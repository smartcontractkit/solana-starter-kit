import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface StateFields {
  version: number
  config: types.BaseConfigFields
}

export interface StateJSON {
  version: number
  config: types.BaseConfigJSON
}

export class State {
  readonly version: number
  readonly config: types.BaseConfig

  static readonly discriminator = Buffer.from([
    216, 146, 107, 94, 104, 75, 182, 177,
  ])

  static readonly layout = borsh.struct([
    borsh.u8("version"),
    types.BaseConfig.layout("config"),
  ])

  constructor(fields: StateFields) {
    this.version = fields.version
    this.config = new types.BaseConfig({ ...fields.config })
  }

  static async fetch(
    c: Connection,
    address: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): Promise<State | null> {
    const info = await c.getAccountInfo(address)

    if (info === null) {
      return null
    }
    if (!info.owner.equals(programId)) {
      throw new Error("account doesn't belong to this program")
    }

    return this.decode(info.data)
  }

  static async fetchMultiple(
    c: Connection,
    addresses: PublicKey[],
    programId: PublicKey = PROGRAM_ID
  ): Promise<Array<State | null>> {
    const infos = await c.getMultipleAccountsInfo(addresses)

    return infos.map((info) => {
      if (info === null) {
        return null
      }
      if (!info.owner.equals(programId)) {
        throw new Error("account doesn't belong to this program")
      }

      return this.decode(info.data)
    })
  }

  static decode(data: Buffer): State {
    if (!data.slice(0, 8).equals(State.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = State.layout.decode(data.slice(8))

    return new State({
      version: dec.version,
      config: types.BaseConfig.fromDecoded(dec.config),
    })
  }

  toJSON(): StateJSON {
    return {
      version: this.version,
      config: this.config.toJSON(),
    }
  }

  static fromJSON(obj: StateJSON): State {
    return new State({
      version: obj.version,
      config: types.BaseConfig.fromJSON(obj.config),
    })
  }
}
