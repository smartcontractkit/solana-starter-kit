import { ethers } from "ethers";
import bs58 from "bs58";
import {
  FinalityRequest,
  SolanaExtraArgsOptions,
  SVMTokenReceiverAtaMode,
} from "../core/models";
import { Logger } from "./logger";

/**
 * Tag for Solana VM-specific extra args V1 (CCIP 1.6 lanes)
 */
export const SVM_EXTRA_ARGS_V1_TAG = "0x1f3b3aba";

/**
 * Tag for GenericExtraArgsV3 (CCIP 2.0 lanes)
 */
export const GENERIC_EXTRA_ARGS_V3_TAG = "0xa69dd4aa";

/**
 * Tag for SVMExecutorArgsV1, carried in GenericExtraArgsV3.executorArgs for Solana destinations
 */
export const SVM_EXECUTOR_ARGS_V1_TAG = "0x1a2b3c4d";

/**
 * Finality flag requesting the source chain's `safe` block tag
 */
export const FINALITY_SAFE_FLAG = 0x00010000;

const MAX_FINALITY_BLOCK_DEPTH = 0xffff;

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

  const version =
    mergedOptions.extraArgsVersion ??
    (mergedOptions.finality !== undefined ? "v3" : "v1");

  if (version === "v3") {
    return encodeSolanaGenericExtraArgsV3(mergedOptions, logger);
  }
  if (mergedOptions.finality !== undefined && encodeFinality(mergedOptions.finality) !== 0) {
    throw new Error(
      "Custom finality requires GenericExtraArgsV3; SVMExtraArgsV1 always waits for finality"
    );
  }
  return encodeSolanaExtraArgs(mergedOptions, logger);
}

/**
 * Encodes a finality request into the uint32 value used by CCIP 2.0 (FinalityCodec)
 *
 * @param finality "finalized" (0), "safe" (0x00010000) or a block depth (1-65535)
 * @returns Encoded finality value
 */
export function encodeFinality(finality: FinalityRequest): number {
  if (finality === "finalized") return 0;
  if (finality === "safe") return FINALITY_SAFE_FLAG;
  if (
    !Number.isInteger(finality) ||
    finality < 0 ||
    finality > MAX_FINALITY_BLOCK_DEPTH
  ) {
    throw new Error(
      `Invalid finality block depth: ${finality} (expected an integer 0-${MAX_FINALITY_BLOCK_DEPTH})`
    );
  }
  return finality;
}

/**
 * Parses a user-supplied finality string ("finalized", "safe" or a block depth)
 */
export function parseFinality(value: string): FinalityRequest {
  const normalized = value.trim().toLowerCase();
  if (normalized === "finalized" || normalized === "finality") return "finalized";
  if (normalized === "safe") return "safe";
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid finality "${value}". Use "finalized", "safe" or a block depth (e.g. 5)`
    );
  }
  const depth = parseInt(normalized, 10);
  encodeFinality(depth);
  return depth === 0 ? "finalized" : depth;
}

/**
 * Returns true when the request asks for less than full finality (FTF)
 */
export function isFasterThanFinality(finality?: FinalityRequest): boolean {
  return finality !== undefined && encodeFinality(finality) !== 0;
}

/**
 * Human-readable description of a finality request
 */
export function describeFinality(finality?: FinalityRequest): string {
  if (finality === undefined || encodeFinality(finality) === 0) {
    return "finalized (wait for full finality)";
  }
  if (finality === "safe") return "safe (source chain `safe` block tag)";
  return `${finality} block confirmation${finality === 1 ? "" : "s"} (Faster-Than-Finality)`;
}

function uintBytes(value: number | bigint, byteLength: number, field: string): Uint8Array {
  const v = BigInt(value);
  if (v < BigInt(0) || v >= BigInt(1) << BigInt(byteLength * 8)) {
    throw new Error(`${field} out of range for ${byteLength * 8}-bit field: ${v}`);
  }
  return ethers.getBytes(ethers.toBeHex(v, byteLength));
}

function solanaAddressBytes(address: string): Uint8Array {
  const bytes = ethers.getBytes(encodeSolanaAddressToBytes32(address));
  if (bytes.length !== 32) {
    throw new Error(`Invalid Solana address (expected 32 bytes): ${address}`);
  }
  return bytes;
}

/**
 * Encodes SVMExecutorArgsV1 (executorArgs for Solana destinations on CCIP 2.0)
 *
 * Layout: tag(4) | useATA(1) | accountIsWritableBitmap(8, BE) | accountsLength(1) | accounts(32 each)
 */
export function encodeSVMExecutorArgsV1(options: {
  tokenReceiverAtaMode?: SVMTokenReceiverAtaMode;
  accountIsWritableBitmap?: bigint;
  accounts?: string[];
}): string {
  const accounts = options.accounts ?? [];
  if (accounts.length > 255) {
    throw new Error(`Too many Solana accounts: ${accounts.length} (max 255)`);
  }
  return ethers.concat([
    SVM_EXECUTOR_ARGS_V1_TAG,
    uintBytes(
      options.tokenReceiverAtaMode ?? SVMTokenReceiverAtaMode.DERIVE_ATA_AND_CREATE,
      1,
      "useATA"
    ),
    uintBytes(options.accountIsWritableBitmap ?? BigInt(0), 8, "accountIsWritableBitmap"),
    uintBytes(accounts.length, 1, "accountsLength"),
    ...accounts.map(solanaAddressBytes),
  ]);
}

/**
 * Encodes GenericExtraArgsV3 for a Solana destination (CCIP 2.0 lanes)
 *
 * Tightly packed, big-endian:
 * tag(4) | gasLimit(4) | finality(4) | ccvsLength(1) | executorLength(1) |
 * executorArgsLength(2) | executorArgs | tokenReceiverLength(1) | tokenReceiver |
 * tokenArgsLength(2) | tokenArgs
 *
 * CCVs and executor are left empty so the lane defaults are used.
 */
export function encodeSolanaGenericExtraArgsV3(
  options: SolanaExtraArgsOptions,
  logger?: Logger
): string {
  const gasLimit = options.computeUnits ?? 200000;
  const finality = encodeFinality(options.finality ?? "finalized");
  const executorArgs = ethers.getBytes(
    encodeSVMExecutorArgsV1({
      tokenReceiverAtaMode: options.tokenReceiverAtaMode,
      accountIsWritableBitmap: options.accountIsWritableBitmap,
      accounts: options.accounts,
    })
  );

  // An all-zero / unset token receiver is encoded as empty
  const tokenReceiverBytes =
    options.tokenReceiver &&
    BigInt(encodeSolanaAddressToBytes32(options.tokenReceiver)) !== BigInt(0)
      ? solanaAddressBytes(options.tokenReceiver)
      : new Uint8Array(0);

  if (options.allowOutOfOrderExecution === false) {
    logger?.warn(
      "allowOutOfOrderExecution=false is ignored: CCIP 2.0 has no ordered execution"
    );
  }

  logger?.debug("Encoding Solana GenericExtraArgsV3:", {
    gasLimit,
    finality: `0x${finality.toString(16).padStart(8, "0")}`,
    accountIsWritableBitmap: (options.accountIsWritableBitmap ?? BigInt(0)).toString(),
    accounts: options.accounts ?? [],
    tokenReceiver: options.tokenReceiver,
  });

  return ethers.concat([
    GENERIC_EXTRA_ARGS_V3_TAG,
    uintBytes(gasLimit, 4, "gasLimit"),
    uintBytes(finality, 4, "finality"),
    uintBytes(0, 1, "ccvsLength"),
    uintBytes(0, 1, "executorLength"),
    uintBytes(executorArgs.length, 2, "executorArgsLength"),
    executorArgs,
    uintBytes(tokenReceiverBytes.length, 1, "tokenReceiverLength"),
    tokenReceiverBytes,
    uintBytes(0, 2, "tokenArgsLength"),
  ]);
}
