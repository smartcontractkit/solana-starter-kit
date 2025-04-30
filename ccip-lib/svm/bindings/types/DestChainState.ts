import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface DestChainStateFields {
  sequenceNumber: BN
  sequenceNumberToRestore: BN
  restoreOnAction: types.RestoreOnActionKind
}

export interface DestChainStateJSON {
  sequenceNumber: string
  sequenceNumberToRestore: string
  restoreOnAction: types.RestoreOnActionJSON
}

export class DestChainState {
  readonly sequenceNumber: BN
  readonly sequenceNumberToRestore: BN
  readonly restoreOnAction: types.RestoreOnActionKind

  constructor(fields: DestChainStateFields) {
    this.sequenceNumber = fields.sequenceNumber
    this.sequenceNumberToRestore = fields.sequenceNumberToRestore
    this.restoreOnAction = fields.restoreOnAction
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.u64("sequenceNumber"),
        borsh.u64("sequenceNumberToRestore"),
        types.RestoreOnAction.layout("restoreOnAction"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new DestChainState({
      sequenceNumber: obj.sequenceNumber,
      sequenceNumberToRestore: obj.sequenceNumberToRestore,
      restoreOnAction: types.RestoreOnAction.fromDecoded(obj.restoreOnAction),
    })
  }

  static toEncodable(fields: DestChainStateFields) {
    return {
      sequenceNumber: fields.sequenceNumber,
      sequenceNumberToRestore: fields.sequenceNumberToRestore,
      restoreOnAction: fields.restoreOnAction.toEncodable(),
    }
  }

  toJSON(): DestChainStateJSON {
    return {
      sequenceNumber: this.sequenceNumber.toString(),
      sequenceNumberToRestore: this.sequenceNumberToRestore.toString(),
      restoreOnAction: this.restoreOnAction.toJSON(),
    }
  }

  static fromJSON(obj: DestChainStateJSON): DestChainState {
    return new DestChainState({
      sequenceNumber: new BN(obj.sequenceNumber),
      sequenceNumberToRestore: new BN(obj.sequenceNumberToRestore),
      restoreOnAction: types.RestoreOnAction.fromJSON(obj.restoreOnAction),
    })
  }

  toEncodable() {
    return DestChainState.toEncodable(this)
  }
}
