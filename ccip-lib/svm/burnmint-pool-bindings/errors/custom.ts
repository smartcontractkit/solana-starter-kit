export type CustomError =
  | InvalidMultisig
  | MintAuthorityAlreadySet
  | FixedMintToken
  | InvalidToken2022Multisig
  | InvalidSPLTokenMultisig
  | PoolSignerNotInMultisig
  | MultisigMustHaveMoreThanOneSigner
  | InvalidMultisigOwner

export class InvalidMultisig extends Error {
  static readonly code = 6000
  readonly code = 6000
  readonly name = "InvalidMultisig"
  readonly msg = "Invalid Multisig Mint"

  constructor(readonly logs?: string[]) {
    super("6000: Invalid Multisig Mint")
  }
}

export class MintAuthorityAlreadySet extends Error {
  static readonly code = 6001
  readonly code = 6001
  readonly name = "MintAuthorityAlreadySet"
  readonly msg = "Mint Authority already set"

  constructor(readonly logs?: string[]) {
    super("6001: Mint Authority already set")
  }
}

export class FixedMintToken extends Error {
  static readonly code = 6002
  readonly code = 6002
  readonly name = "FixedMintToken"
  readonly msg = "Token with no Mint Authority"

  constructor(readonly logs?: string[]) {
    super("6002: Token with no Mint Authority")
  }
}

export class InvalidToken2022Multisig extends Error {
  static readonly code = 6003
  readonly code = 6003
  readonly name = "InvalidToken2022Multisig"
  readonly msg = "Invalid Multisig Account Data for Token 2022"

  constructor(readonly logs?: string[]) {
    super("6003: Invalid Multisig Account Data for Token 2022")
  }
}

export class InvalidSPLTokenMultisig extends Error {
  static readonly code = 6004
  readonly code = 6004
  readonly name = "InvalidSPLTokenMultisig"
  readonly msg = "Invalid Multisig Account Data for SPL Token"

  constructor(readonly logs?: string[]) {
    super("6004: Invalid Multisig Account Data for SPL Token")
  }
}

export class PoolSignerNotInMultisig extends Error {
  static readonly code = 6005
  readonly code = 6005
  readonly name = "PoolSignerNotInMultisig"
  readonly msg = "Token Pool Signer PDA must be signer of the Multisig"

  constructor(readonly logs?: string[]) {
    super("6005: Token Pool Signer PDA must be signer of the Multisig")
  }
}

export class MultisigMustHaveMoreThanOneSigner extends Error {
  static readonly code = 6006
  readonly code = 6006
  readonly name = "MultisigMustHaveMoreThanOneSigner"
  readonly msg = "Multisig must have more than one signer"

  constructor(readonly logs?: string[]) {
    super("6006: Multisig must have more than one signer")
  }
}

export class InvalidMultisigOwner extends Error {
  static readonly code = 6007
  readonly code = 6007
  readonly name = "InvalidMultisigOwner"
  readonly msg = "Multisig Owner must match Token Program ID"

  constructor(readonly logs?: string[]) {
    super("6007: Multisig Owner must match Token Program ID")
  }
}

export function fromCode(code: number, logs?: string[]): CustomError | null {
  switch (code) {
    case 6000:
      return new InvalidMultisig(logs)
    case 6001:
      return new MintAuthorityAlreadySet(logs)
    case 6002:
      return new FixedMintToken(logs)
    case 6003:
      return new InvalidToken2022Multisig(logs)
    case 6004:
      return new InvalidSPLTokenMultisig(logs)
    case 6005:
      return new PoolSignerNotInMultisig(logs)
    case 6006:
      return new MultisigMustHaveMoreThanOneSigner(logs)
    case 6007:
      return new InvalidMultisigOwner(logs)
  }

  return null
}
