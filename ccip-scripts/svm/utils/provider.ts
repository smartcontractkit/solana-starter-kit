import { Keypair } from "@solana/web3.js";
import fs from "fs";
import { KEYPAIR_PATHS } from "./config-parser";
import { createLogger } from "../../../ccip-lib/svm/utils/logger";

const logger = createLogger('Provider');

/**
 * Loads a keypair from a file
 * @param filePath Path to keypair file
 * @returns Keypair
 */
export function loadKeypair(filePath: string = KEYPAIR_PATHS.DEFAULT): Keypair {
  try {
    const keypairData = fs.readFileSync(filePath, "utf-8");
    const keypairJson = JSON.parse(keypairData);
    return Keypair.fromSecretKey(Buffer.from(keypairJson));
  } catch (error) {
    logger.error(`Error loading keypair from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
