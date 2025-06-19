import { ethers } from "ethers";
import bs58 from "bs58";
import { SolanaExtraArgsOptions } from "../core/models";
import { Logger } from "./logger";

/**
 * Tag for Solana VM-specific extra args V1
 */
export const SVM_EXTRA_ARGS_V1_TAG = "0x1f3b3aba";

/**
 * Encodes a Solana address to bytes32 format for use in CCIP
 *
 * @param solanaAddress Solana address in base58 format
 * @returns Bytes32 encoded address (with 0x prefix)
 */
export function encodeSolanaAddressToBytes32(solanaAddress: string): string {
  // Handle cases where address is already in hex or empty
  if (
    !solanaAddress ||
    solanaAddress === ethers.ZeroHash ||
    solanaAddress.startsWith("0x")
  ) {
    return solanaAddress; // Already in hex format or empty
  }

  // Convert base58 Solana address to bytes32
  const addressBytes = bs58.decode(solanaAddress);
  const bytes32Address = `0x${Buffer.from(addressBytes).toString("hex")}`;

  return bytes32Address;
}

/**
 * Encodes Solana VM-specific extra args for CCIP messages
 *
 * @param options Extra args options
 * @param logger Optional logger for diagnostic information
 * @returns Encoded extra args string with SVM tag
 */
export function encodeSolanaExtraArgs(
  options: SolanaExtraArgsOptions,
  logger?: Logger
): string {
  // Set default values if not provided
  const computeUnits = options.computeUnits ?? 200000;
  const accountIsWritableBitmap = options.accountIsWritableBitmap ?? BigInt(0);
  const allowOutOfOrderExecution = options.allowOutOfOrderExecution ?? true;
  const tokenReceiver = options.tokenReceiver ?? ethers.ZeroHash;
  const accounts = options.accounts ?? [];

  // Log configuration if logger is provided
  if (logger) {
    logger.debug("Encoding Solana extra args:", {
      computeUnits,
      accountIsWritableBitmap: accountIsWritableBitmap.toString(),
      allowOutOfOrderExecution,
      tokenReceiver,
      accounts,
    });
  }

  // Encode tokenReceiver to bytes32
  const tokenReceiverBytes32 = encodeSolanaAddressToBytes32(tokenReceiver);

  // Encode each account in the accounts array to bytes32
  const bytes32Accounts = accounts.map((account) =>
    encodeSolanaAddressToBytes32(account)
  );

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Encode as a properly formatted SVMExtraArgsV1 struct
  // The contract expects to decode a full struct, not individual parameters
  const structEncoded = abiCoder.encode(
    ["tuple(uint32,uint64,bool,bytes32,bytes32[])"],
    [
      [
        computeUnits,
        accountIsWritableBitmap,
        allowOutOfOrderExecution,
        tokenReceiverBytes32,
        bytes32Accounts,
      ],
    ]
  );

  // Combine the SVM tag with the encoded struct (removing the 0x prefix)
  return SVM_EXTRA_ARGS_V1_TAG + structEncoded.slice(2);
}

/**
 * Converts a hex string to a Solana address in base58 format
 *
 * @param hexAddress Hex string of the Solana address
 * @returns Base58 encoded Solana address
 */
export function hexToSolanaAddress(hexAddress: string): string {
  // Remove '0x' prefix if present
  const cleanHex = hexAddress.startsWith("0x")
    ? hexAddress.slice(2)
    : hexAddress;

  // Convert hex to bytes and then to base58
  const bytes = Buffer.from(cleanHex, "hex");
  return bs58.encode(bytes);
}

/**
 * Creates the SVM extra args with default values and sensible overrides
 *
 * @param options Extra args options to override defaults
 * @param logger Optional logger for diagnostic information
 * @returns Encoded extra args string
 */
export function createSolanaExtraArgs(
  options: Partial<SolanaExtraArgsOptions> = {},
  logger?: Logger
): string {
  // Default values for Solana VM execution
  const defaults: SolanaExtraArgsOptions = {
    computeUnits: 200000,
    accountIsWritableBitmap: BigInt(0),
    allowOutOfOrderExecution: true,
    accounts: [],
  };

  // Merge defaults with provided options
  const mergedOptions: SolanaExtraArgsOptions = {
    ...defaults,
    ...options,
  };

  return encodeSolanaExtraArgs(mergedOptions, logger);
}
