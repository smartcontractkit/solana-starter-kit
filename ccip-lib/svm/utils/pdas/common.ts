/**
 * Common utilities for PDA derivation
 */

/**
 * Converts a u64 to 8-byte little endian buffer
 * @param n - Number to convert
 * @returns Buffer representation
 */
export function uint64ToLE(n: number | bigint): Buffer {
  const bn = BigInt(n);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(bn);
  return buf;
}
