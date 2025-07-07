export type CustomError =
  | InvalidMultisig
  | MintAuthorityAlreadySet
  | FixedMintToken
  | UnsupportedTokenProgram
  | InvalidToken2022Multisig
  | InvalidSPLTokenMultisig
  | PoolSignerNotInMultisig
  | MultisigMustHaveAtLeastTwoSigners
  | MultisigMustHaveMoreThanOneSigner
  | InvalidMultisigOwner
  | InvalidMultisigThreshold
  | InvalidMultisigThresholdTooHigh

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

export class UnsupportedTokenProgram extends Error {
  static readonly code = 6003
  readonly code = 6003
  readonly name = "UnsupportedTokenProgram"
  readonly msg = "Unsupported Token Program"

  constructor(readonly logs?: string[]) {
    super("6003: Unsupported Token Program")
  }
}

export class InvalidToken2022Multisig extends Error {
  static readonly code = 6004
  readonly code = 6004
  readonly name = "InvalidToken2022Multisig"
  readonly msg = "Invalid Multisig Account Data for Token 2022"

  constructor(readonly logs?: string[]) {
    super("6004: Invalid Multisig Account Data for Token 2022")
  }
}

export class InvalidSPLTokenMultisig extends Error {
  static readonly code = 6005
  readonly code = 6005
  readonly name = "InvalidSPLTokenMultisig"
  readonly msg = "Invalid Multisig Account Data for SPL Token"

  constructor(readonly logs?: string[]) {
    super("6005: Invalid Multisig Account Data for SPL Token")
  }
}

export class PoolSignerNotInMultisig extends Error {
  static readonly code = 6006
  readonly code = 6006
  readonly name = "PoolSignerNotInMultisig"
  readonly msg =
    "Token Pool Signer PDA must be m times a signer of the Multisig"

  constructor(readonly logs?: string[]) {
    super(
      "6006: Token Pool Signer PDA must be m times a signer of the Multisig"
    )
  }
}

export class MultisigMustHaveAtLeastTwoSigners extends Error {
  static readonly code = 6007
  readonly code = 6007
  readonly name = "MultisigMustHaveAtLeastTwoSigners"
  readonly msg = "Multisig must have more than 2 valid signers"

  constructor(readonly logs?: string[]) {
    super("6007: Multisig must have more than 2 valid signers")
  }
}

export class MultisigMustHaveMoreThanOneSigner extends Error {
  static readonly code = 6008
  readonly code = 6008
  readonly name = "MultisigMustHaveMoreThanOneSigner"
  readonly msg = "Multisig must have more than one required signer"

  constructor(readonly logs?: string[]) {
    super("6008: Multisig must have more than one required signer")
  }
}

export class InvalidMultisigOwner extends Error {
  static readonly code = 6009
  readonly code = 6009
  readonly name = "InvalidMultisigOwner"
  readonly msg = "Multisig Owner must match Token Program ID"

  constructor(readonly logs?: string[]) {
    super("6009: Multisig Owner must match Token Program ID")
  }
}

export class InvalidMultisigThreshold extends Error {
  static readonly code = 6010
  readonly code = 6010
  readonly name = "InvalidMultisigThreshold"
  readonly msg =
    "Invalid multisig threshold: required signatures cannot exceed total signers"

  constructor(readonly logs?: string[]) {
    super(
      "6010: Invalid multisig threshold: required signatures cannot exceed total signers"
    )
  }
}

export class InvalidMultisigThresholdTooHigh extends Error {
  static readonly code = 6011
  readonly code = 6011
  readonly name = "InvalidMultisigThresholdTooHigh"
  readonly msg =
    "Invalid multisig m: required signatures cannot exceed the available for outside signers"

  constructor(readonly logs?: string[]) {
    super(
      "6011: Invalid multisig m: required signatures cannot exceed the available for outside signers"
    )
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
      return new UnsupportedTokenProgram(logs)
    case 6004:
      return new InvalidToken2022Multisig(logs)
    case 6005:
      return new InvalidSPLTokenMultisig(logs)
    case 6006:
      return new PoolSignerNotInMultisig(logs)
    case 6007:
      return new MultisigMustHaveAtLeastTwoSigners(logs)
    case 6008:
      return new MultisigMustHaveMoreThanOneSigner(logs)
    case 6009:
      return new InvalidMultisigOwner(logs)
    case 6010:
      return new InvalidMultisigThreshold(logs)
    case 6011:
      return new InvalidMultisigThresholdTooHigh(logs)
  }

  return null
}
