/**
 * Solana account management utilities for CCIP operations
 */

/**
 * Account specification for bitmap calculation
 */
export interface AccountSpec {
  /** Account public key as string */
  publicKey: string;
  /** Whether the account should be writable */
  isWritable: boolean;
  /** Whether the account is a signer */
  isSigner?: boolean;
}

/**
 * Utilities for managing Solana accounts in CCIP messages
 */
export class SolanaAccountManager {
  /**
   * Calculate account writable bitmap from account specifications
   * 
   * The bitmap represents which accounts should be writable, with bit positions
   * corresponding to account indices. Bit 0 (rightmost) = account 0, etc.
   * 
   * @param accounts Array of account specifications
   * @returns Bitmap as bigint where set bits indicate writable accounts
   * 
   * @example
   * ```typescript
   * const accounts = [
   *   { publicKey: "11111111111111111111111111111111", isWritable: false }, // bit 0 = 0
   *   { publicKey: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", isWritable: true },  // bit 1 = 1
   *   { publicKey: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", isWritable: true },  // bit 2 = 1
   * ];
   * 
   * const bitmap = SolanaAccountManager.calculateWritableBitmap(accounts);
   * // Returns 6 (binary: 110, decimal: 6)
   * // bit 0 = 0 (not writable), bit 1 = 1 (writable), bit 2 = 1 (writable)
   * ```
   */
  static calculateWritableBitmap(accounts: AccountSpec[]): bigint {
    let bitmap = BigInt(0);

    for (let i = 0; i < accounts.length; i++) {
      if (accounts[i].isWritable) {
        // Set bit i (account index) to 1 for writable accounts
        bitmap |= BigInt(1) << BigInt(i);
      }
    }

    return bitmap;
  }

  /**
   * Get human-readable explanation of a bitmap
   * 
   * @param bitmap The bitmap value
   * @param accountCount Number of accounts the bitmap applies to
   * @returns Object with binary representation and per-account breakdown
   * 
   * @example
   * ```typescript
   * const explanation = SolanaAccountManager.explainBitmap(BigInt(46), 7);
   * // Returns:
   * // {
   * //   binary: "0101110",
   * //   decimal: 46,
   * //   accounts: [
   * //     { index: 0, writable: false },
   * //     { index: 1, writable: true },
   * //     { index: 2, writable: true },
   * //     { index: 3, writable: true },
   * //     { index: 4, writable: false },
   * //     { index: 5, writable: true },
   * //     { index: 6, writable: false }
   * //   ]
   * // }
   * ```
   */
  static explainBitmap(bitmap: bigint, accountCount: number): {
    binary: string;
    decimal: number;
    accounts: Array<{ index: number; writable: boolean }>;
  } {
    const binaryStr = bitmap.toString(2).padStart(accountCount, '0');
    const accounts = [];

    for (let i = 0; i < accountCount; i++) {
      // Check if bit i is set (account i is writable)
      const isWritable = (bitmap & (BigInt(1) << BigInt(i))) !== BigInt(0);
      accounts.push({ index: i, writable: isWritable });
    }

    return {
      binary: binaryStr,
      decimal: Number(bitmap),
      accounts,
    };
  }

  /**
   * Validate that a bitmap is appropriate for the given number of accounts
   * 
   * @param bitmap The bitmap to validate
   * @param accountCount Expected number of accounts
   * @throws Error if bitmap has bits set beyond the account count
   */
  static validateBitmap(bitmap: bigint, accountCount: number): void {
    // Check if any bits are set beyond the account count
    const maxValidBitmap = (BigInt(1) << BigInt(accountCount)) - BigInt(1);
    
    if (bitmap > maxValidBitmap) {
      throw new Error(
        `Invalid bitmap ${bitmap} for ${accountCount} accounts. ` +
        `Maximum valid bitmap is ${maxValidBitmap} (binary: ${maxValidBitmap.toString(2)})`
      );
    }

    if (bitmap < 0) {
      throw new Error(`Bitmap cannot be negative: ${bitmap}`);
    }
  }

  /**
   * Create a bitmap from a simple boolean array indicating writability
   * 
   * @param writableFlags Array of boolean values where true = writable
   * @returns Calculated bitmap
   * 
   * @example
   * ```typescript
   * // For accounts [readonly, writable, writable, readonly]
   * const bitmap = SolanaAccountManager.createBitmapFromFlags([false, true, true, false]);
   * // Returns 6 (binary: 0110)
   * ```
   */
  static createBitmapFromFlags(writableFlags: boolean[]): bigint {
    const accounts: AccountSpec[] = writableFlags.map((isWritable, index) => ({
      publicKey: `placeholder_${index}`,
      isWritable,
    }));

    return this.calculateWritableBitmap(accounts);
  }
}