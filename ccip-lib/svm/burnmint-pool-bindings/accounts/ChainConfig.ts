import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface ChainConfigFields {
  base: types.BaseChainFields
}

export interface ChainConfigJSON {
  base: types.BaseChainJSON
}

export class ChainConfig {
  readonly base: types.BaseChain

  static readonly discriminator = Buffer.from([
    13, 177, 233, 141, 212, 29, 148, 56,
  ])

  static readonly layout = borsh.struct([types.BaseChain.layout("base")])

  constructor(fields: ChainConfigFields) {
    this.base = new types.BaseChain({ ...fields.base })
  }

  static async fetch(
    c: Connection,
    address: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): Promise<ChainConfig | null> {
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
  ): Promise<Array<ChainConfig | null>> {
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

  static decode(data: Buffer): ChainConfig {
    if (!data.slice(0, 8).equals(ChainConfig.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = ChainConfig.layout.decode(data.slice(8))

    return new ChainConfig({
      base: types.BaseChain.fromDecoded(dec.base),
    })
  }

  toJSON(): ChainConfigJSON {
    return {
      base: this.base.toJSON(),
    }
  }

  static fromJSON(obj: ChainConfigJSON): ChainConfig {
    return new ChainConfig({
      base: types.BaseChain.fromJSON(obj.base),
    })
  }
}
