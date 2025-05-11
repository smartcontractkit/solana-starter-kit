import { PublicKey, Connection } from "@solana/web3.js";
import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId";

export interface TokenAdminRegistryFields {
  version: number;
  administrator: PublicKey;
  pendingAdministrator: PublicKey;
  lookupTable: PublicKey;
  writableIndexes: Array<BN>;
  mint: PublicKey;
}

export interface TokenAdminRegistryJSON {
  version: number;
  administrator: string;
  pendingAdministrator: string;
  lookupTable: string;
  writableIndexes: Array<string>;
  mint: string;
}

export class TokenAdminRegistry {
  readonly version: number;
  readonly administrator: PublicKey;
  readonly pendingAdministrator: PublicKey;
  readonly lookupTable: PublicKey;
  readonly writableIndexes: Array<BN>;
  readonly mint: PublicKey;

  static readonly discriminator = Buffer.from([
    70, 92, 207, 200, 76, 17, 57, 114,
  ]);

  static readonly layout = borsh.struct([
    borsh.u8("version"),
    borsh.publicKey("administrator"),
    borsh.publicKey("pendingAdministrator"),
    borsh.publicKey("lookupTable"),
    borsh.array(borsh.u128(), 2, "writableIndexes"),
    borsh.publicKey("mint"),
  ]);

  constructor(fields: TokenAdminRegistryFields) {
    this.version = fields.version;
    this.administrator = fields.administrator;
    this.pendingAdministrator = fields.pendingAdministrator;
    this.lookupTable = fields.lookupTable;
    this.writableIndexes = fields.writableIndexes;
    this.mint = fields.mint;
  }

  static async fetch(
    c: Connection,
    address: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): Promise<TokenAdminRegistry | null> {
    const info = await c.getAccountInfo(address);

    if (info === null) {
      return null;
    }
    if (!info.owner.equals(programId)) {
      throw new Error("account doesn't belong to this program");
    }

    return this.decode(info.data);
  }

  static async fetchMultiple(
    c: Connection,
    addresses: PublicKey[],
    programId: PublicKey = PROGRAM_ID
  ): Promise<Array<TokenAdminRegistry | null>> {
    const infos = await c.getMultipleAccountsInfo(addresses);

    return infos.map((info) => {
      if (info === null) {
        return null;
      }
      if (!info.owner.equals(programId)) {
        throw new Error("account doesn't belong to this program");
      }

      return this.decode(info.data);
    });
  }

  static decode(data: Buffer): TokenAdminRegistry {
    if (!data.slice(0, 8).equals(TokenAdminRegistry.discriminator)) {
      throw new Error("invalid account discriminator");
    }

    const dec = TokenAdminRegistry.layout.decode(data.slice(8));

    return new TokenAdminRegistry({
      version: dec.version,
      administrator: dec.administrator,
      pendingAdministrator: dec.pendingAdministrator,
      lookupTable: dec.lookupTable,
      writableIndexes: dec.writableIndexes,
      mint: dec.mint,
    });
  }

  toJSON(): TokenAdminRegistryJSON {
    return {
      version: this.version,
      administrator: this.administrator.toString(),
      pendingAdministrator: this.pendingAdministrator.toString(),
      lookupTable: this.lookupTable.toString(),
      writableIndexes: this.writableIndexes.map((item) => item.toString()),
      mint: this.mint.toString(),
    };
  }

  static fromJSON(obj: TokenAdminRegistryJSON): TokenAdminRegistry {
    return new TokenAdminRegistry({
      version: obj.version,
      administrator: new PublicKey(obj.administrator),
      pendingAdministrator: new PublicKey(obj.pendingAdministrator),
      lookupTable: new PublicKey(obj.lookupTable),
      writableIndexes: obj.writableIndexes.map((item) => new BN(item)),
      mint: new PublicKey(obj.mint),
    });
  }
}
