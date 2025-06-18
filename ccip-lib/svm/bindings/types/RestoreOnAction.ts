import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface NoneJSON {
  kind: "None"
}

export class None {
  static readonly discriminator = 0
  static readonly kind = "None"
  readonly discriminator = 0
  readonly kind = "None"

  toJSON(): NoneJSON {
    return {
      kind: "None",
    }
  }

  toEncodable() {
    return {
      None: {},
    }
  }
}

export interface UpgradeJSON {
  kind: "Upgrade"
}

export class Upgrade {
  static readonly discriminator = 1
  static readonly kind = "Upgrade"
  readonly discriminator = 1
  readonly kind = "Upgrade"

  toJSON(): UpgradeJSON {
    return {
      kind: "Upgrade",
    }
  }

  toEncodable() {
    return {
      Upgrade: {},
    }
  }
}

export interface RollbackJSON {
  kind: "Rollback"
}

export class Rollback {
  static readonly discriminator = 2
  static readonly kind = "Rollback"
  readonly discriminator = 2
  readonly kind = "Rollback"

  toJSON(): RollbackJSON {
    return {
      kind: "Rollback",
    }
  }

  toEncodable() {
    return {
      Rollback: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.RestoreOnActionKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("None" in obj) {
    return new None()
  }
  if ("Upgrade" in obj) {
    return new Upgrade()
  }
  if ("Rollback" in obj) {
    return new Rollback()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(
  obj: types.RestoreOnActionJSON
): types.RestoreOnActionKind {
  switch (obj.kind) {
    case "None": {
      return new None()
    }
    case "Upgrade": {
      return new Upgrade()
    }
    case "Rollback": {
      return new Rollback()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "None"),
    borsh.struct([], "Upgrade"),
    borsh.struct([], "Rollback"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
