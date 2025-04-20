import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface DestChainFields {
  version: number
  chainSelector: BN
  state: types.DestChainStateFields
  config: types.DestChainConfigFields
}

export interface DestChainJSON {
  version: number
  chainSelector: string
  state: types.DestChainStateJSON
  config: types.DestChainConfigJSON
}

export class DestChain {
  readonly version: number
  readonly chainSelector: BN
  readonly state: types.DestChainState
  readonly config: types.DestChainConfig

  static readonly discriminator = Buffer.from([
    77, 18, 241, 132, 212, 54, 218, 16,
  ])

  static readonly layout = borsh.struct([
    borsh.u8("version"),
    borsh.u64("chainSelector"),
    types.DestChainState.layout("state"),
    types.DestChainConfig.layout("config"),
  ])

  constructor(fields: DestChainFields) {
    this.version = fields.version
    this.chainSelector = fields.chainSelector
    this.state = new types.DestChainState({ ...fields.state })
    this.config = new types.DestChainConfig({ ...fields.config })
  }

  static async fetch(
    c: Connection,
    address: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): Promise<DestChain | null> {
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
  ): Promise<Array<DestChain | null>> {
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

  static decode(data: Buffer): DestChain {
    if (!data.slice(0, 8).equals(DestChain.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = DestChain.layout.decode(data.slice(8))

    return new DestChain({
      version: dec.version,
      chainSelector: dec.chainSelector,
      state: types.DestChainState.fromDecoded(dec.state),
      config: types.DestChainConfig.fromDecoded(dec.config),
    })
  }

  toJSON(): DestChainJSON {
    return {
      version: this.version,
      chainSelector: this.chainSelector.toString(),
      state: this.state.toJSON(),
      config: this.config.toJSON(),
    }
  }

  static fromJSON(obj: DestChainJSON): DestChain {
    return new DestChain({
      version: obj.version,
      chainSelector: new BN(obj.chainSelector),
      state: types.DestChainState.fromJSON(obj.state),
      config: types.DestChainConfig.fromJSON(obj.config),
    })
  }
}
