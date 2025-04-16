/**
 * Utilities for Solana to EVM address conversion
 */
export class AddressConversion {
  /**
   * Converts an EVM address string (0x-prefixed) into a 32-byte left-padded Uint8Array.
   * Required for EVM-to-Solana compatibility in programs expecting 32-byte addresses.
   * @param evmAddress EVM address (0x-prefixed)
   * @returns 32-byte padded address as Uint8Array
   */
  static evmAddressToSolanaBytes(evmAddress: string): Uint8Array {
    return this.leftPadBytes(this.hexToBytes(evmAddress), 32);
  }

  /**
   * Pretty prints a byte array as a 0x-prefixed hex string
   * @param bytes Byte array
   * @returns Hex string
   */
  static bytesToHexString(bytes: Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex');
  }

  /**
   * Converts a hex string to a byte array
   * @param hex Hex string
   * @returns Byte array
   */
  private static hexToBytes(hex: string): Uint8Array {
    if (hex.startsWith('0x')) hex = hex.slice(2);
    if (hex.length !== 40) throw new Error('Invalid Ethereum address length');
    const bytes = new Uint8Array(20);
    for (let i = 0; i < 40; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Left pads a byte array to a specified length
   * @param data Data to pad
   * @param length Target length
   * @returns Padded byte array
   */
  private static leftPadBytes(data: Uint8Array, length: number): Uint8Array {
    if (data.length > length) throw new Error('Data too long to pad');
    const padded = new Uint8Array(length);
    padded.set(data, length - data.length);
    return padded;
  }
}

/**
 * Creates a buffer from a BigInt
 * @param value BigInt value
 * @returns Buffer
 */
export function createBufferFromBigInt(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
} 