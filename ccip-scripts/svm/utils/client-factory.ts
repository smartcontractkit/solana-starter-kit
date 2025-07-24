import { loadKeypair } from "./provider";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

/**
 * Loads the CCIP Basic Receiver IDL and creates an Anchor Program instance
 *
 * This function sets up an Anchor program interface for interacting with the CCIP Basic Receiver.
 * It reads the IDL from the local build artifacts and creates a program instance that can be used
 * to call instructions and fetch account data from the receiver program.
 *
 * @param keypairPath Path to the keypair file for signing transactions
 * @param connection Web3 connection to use for RPC calls
 * @param programId Program ID of the receiver (optional, will use the one from IDL if not provided)
 * @returns Object containing the Anchor Program instance and the loaded IDL
 * @throws Error if IDL file is not found or program ID cannot be determined
 *
 * @example
 * ```typescript
 * const { program, idl } = loadReceiverProgram(
 *   "~/.config/solana/id.json",
 *   connection,
 *   new PublicKey("11111111111111111111111111111112")
 * );
 * ```
 */
export function loadReceiverProgram(
  keypairPath: string,
  connection: Connection,
  programId?: PublicKey
): { program: anchor.Program; idl: any } {
  // Set up Anchor provider
  const keypair = loadKeypair(keypairPath);
  const anchorProvider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(keypair),
    { commitment: "confirmed" }
  );
  anchor.setProvider(anchorProvider);

  // Find the local IDL file
  const idlPath = path.join(
    __dirname,
    "../../../target/idl/ccip_basic_receiver.json"
  );

  if (!fs.existsSync(idlPath)) {
    throw new Error(
      `IDL file not found at ${idlPath}. Please build the program first with 'anchor build'`
    );
  }

  // Read IDL
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Use provided programId or get from IDL
  const programIdToUse =
    programId ||
    (idl.address
      ? new PublicKey(idl.address)
      : idl.metadata?.address
      ? new PublicKey(idl.metadata.address)
      : null);

  if (!programIdToUse) {
    throw new Error("Program ID not provided and not found in IDL metadata");
  }

  // Create program interface
  const program = new anchor.Program(idl, anchorProvider);

  return { program, idl };
}
