import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Default file paths
export const DEFAULT_KEYPAIR_PATH = path.resolve(process.env.HOME || "", ".config/solana/keytest.json");

/**
 * Loads a keypair from a file
 * @param filePath Path to keypair file
 * @returns Keypair
 */
export function loadKeypair(filePath: string = DEFAULT_KEYPAIR_PATH): Keypair {
  try {
    const keypairData = fs.readFileSync(filePath, "utf-8");
    const keypairJson = JSON.parse(keypairData);
    return Keypair.fromSecretKey(Buffer.from(keypairJson));
  } catch (error) {
    console.error(`Error loading keypair from ${filePath}:`, error);
    throw error;
  }
} 