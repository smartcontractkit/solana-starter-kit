import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Logger } from "./logger";

/**
 * Automatically detects the token program for a given mint by checking on-chain data
 *
 * @param tokenMint The token mint public key
 * @param connection Solana connection
 * @param logger Optional logger for debug output
 * @returns The detected token program public key
 */
export async function detectTokenProgram(
  tokenMint: PublicKey,
  connection: Connection,
  logger?: Logger
): Promise<PublicKey> {
  try {
    const tokenMintInfo = await connection.getAccountInfo(tokenMint);
    if (tokenMintInfo) {
      const tokenProgram = tokenMintInfo.owner;
      logger?.debug(
        `Auto-detected token program: ${tokenProgram.toString()} for token: ${tokenMint.toString()}`
      );
      return tokenProgram;
    } else {
      logger?.warn(
        `Token mint info not found for ${tokenMint.toString()}, using fallback token program ${TOKEN_2022_PROGRAM_ID.toString()}`
      );
      return TOKEN_2022_PROGRAM_ID;
    }
  } catch (error) {
    logger?.warn(
      `Error determining token program, using fallback: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return TOKEN_2022_PROGRAM_ID;
  }
}
