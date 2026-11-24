// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {FinalityCodec} from "@chainlink/contracts-ccip/contracts/libraries/FinalityCodec.sol";

import {Ownable} from "@openzeppelin/contracts@5.3.0/access/Ownable.sol";

/// @title BasicCCIPReceiver - Minimal CCIP 2.0 receiver for the Solana starter kit.
/// @notice Receives CCIP messages from Solana (or any chain), stores the latest message,
/// and lets its owner configure per-source-chain CCV requirements and allowed finality
/// (Faster-Than-Finality) via `getCCVsAndFinalityConfig`.
contract BasicCCIPReceiver is CCIPReceiver, Ownable {
  event MessageReceived(bytes32 indexed messageId, uint64 indexed sourceChainSelector, bytes sender, bytes data);
  event SourceChainConfigSet(uint64 indexed sourceChainSelector, bytes4 allowedFinalityConfig);

  /// @notice Per-source-chain policy: which finality modes the receiver accepts.
  /// @dev `allowedFinalityConfig` uses FinalityCodec encoding:
  ///   - WAIT_FOR_FINALITY_FLAG (0x00000000): only fully finalized messages
  ///   - WAIT_FOR_SAFE_FLAG (0x00010000): finalized or safe-tagged messages
  ///   - block depth N (low 16 bits): finalized or >= N block confirmations
  struct SourceChainConfig {
    bytes4 allowedFinalityConfig;
    bool set;
  }

  /// @dev Latest received message, exposed for off-chain inspection.
  Client.Any2EVMMessage internal s_lastMessage;

  /// @dev Per-source-chain finality policy. Unset chains default to finality-only.
  mapping(uint64 sourceChainSelector => SourceChainConfig) internal s_sourceChainConfigs;

  constructor(address router) CCIPReceiver(router) Ownable(msg.sender) {}

  /// @notice Store the message and emit an event. Called by the router only.
  /// @dev Override this to add custom logic for your application.
  function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
    s_lastMessage = message;
    emit MessageReceived(message.messageId, message.sourceChainSelector, message.sender, message.data);
  }

  /// @notice Set the allowed finality config for a source chain (owner only).
  /// @param sourceChainSelector The source chain selector (e.g. Solana Devnet).
  /// @param allowedFinalityConfig FinalityCodec-encoded policy. Use FinalityCodec
  /// constants/helpers to build it, e.g.:
  ///   - FinalityCodec.WAIT_FOR_FINALITY_FLAG
  ///   - FinalityCodec.WAIT_FOR_SAFE_FLAG
  ///   - FinalityCodec._encodeBlockDepth(N)
  ///   - FinalityCodec._encodeBlockDepthAndSafeTag(N)
  function setSourceChainConfig(uint64 sourceChainSelector, bytes4 allowedFinalityConfig) external onlyOwner {
    s_sourceChainConfigs[sourceChainSelector] = SourceChainConfig({allowedFinalityConfig: allowedFinalityConfig, set: true});
    emit SourceChainConfigSet(sourceChainSelector, allowedFinalityConfig);
  }

  /// @notice Remove a source chain's config, reverting it to finality-only (owner only).
  function removeSourceChainConfig(uint64 sourceChainSelector) external onlyOwner {
    delete s_sourceChainConfigs[sourceChainSelector];
    emit SourceChainConfigSet(sourceChainSelector, FinalityCodec.WAIT_FOR_FINALITY_FLAG);
  }

  /// @notice Return the latest received message.
  function getLastMessage() external view returns (Client.Any2EVMMessage memory) {
    return s_lastMessage;
  }

  /// @notice Return the CCVs required/optional and allowed finality config for a source chain.
  /// @dev No specific CCVs are required (the lane's default CCV set applies). Finality policy
  /// comes from the owner-set per-source-chain config; unset chains accept finalized only.
  function getCCVsAndFinalityConfig(
    uint64 sourceChainSelector,
    bytes calldata
  ) external view override returns (address[] memory requiredCCVs, address[] memory optionalCCVs, uint8 optionalThreshold, bytes4 allowedFinalityConfig) {
    SourceChainConfig memory config = s_sourceChainConfigs[sourceChainSelector];
    allowedFinalityConfig = config.set ? config.allowedFinalityConfig : FinalityCodec.WAIT_FOR_FINALITY_FLAG;
    return (new address[](0), new address[](0), 0, allowedFinalityConfig);
  }
}
