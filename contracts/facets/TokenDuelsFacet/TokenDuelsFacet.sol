// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _Ownable } from "@solidstate/contracts/access/ownable/_Ownable.sol";

import { OperableInternal } from "../OperableFacet/OperableInternal.sol";

import { ITokenDuelsFacet } from "./ITokenDuelsFacet.sol";
import { TokenDuelsInternal } from "./TokenDuelsInternal.sol";
import { TokenDuelsStorage } from "./TokenDuelsStorage.sol";

/// @title TokenDuelsFacet
/// @dev ERC20 token, fixed stake (10 tokens), 2-player token duels
contract TokenDuelsFacet is ITokenDuelsFacet, TokenDuelsInternal, OperableInternal, _Ownable {
    // ============ Errors ============

    error TokenDuelsFacet__NotOperator();

    // ============ Modifiers ============

    modifier onlyOwnerOrOperator() {
        if (msg.sender != _owner() && !_isOperator(msg.sender)) revert TokenDuelsFacet__NotOperator();
        _;
    }

    // ============ External Functions ============

    function stakeAmount() external view returns (uint256) {
        return _getStakeAmount();
    }

    function configureToken(address token) external onlyOwnerOrOperator {
        _configureToken(token);
    }

    function configuredToken() external view returns (address token, uint8 decimals) {
        return _getConfiguredToken();
    }

    function createGame(uint256 sessionId, uint256 gameId) external {
        _createGame(sessionId, gameId);
    }

    function createGameWithSignature(
        uint256 sessionId,
        uint256 gameId,
        address userAddress,
        uint256 deadline,
        bytes memory signature
    ) external {
        _createGameWithSignature(sessionId, gameId, userAddress, deadline, signature);
    }

    function joinGame(uint256 sessionId) external {
        _joinGame(sessionId);
    }

    function joinGameWithSignature(
        uint256 sessionId,
        address userAddress,
        uint256 deadline,
        bytes memory signature
    ) external {
        _joinGameWithSignature(sessionId, userAddress, deadline, signature);
    }

    function settleGame(uint256 sessionId, address winner) external onlyOwnerOrOperator {
        _settleGame(sessionId, winner);
    }

    function cancelWaitingGame(uint256 sessionId) external onlyOwnerOrOperator {
        _cancelWaitingGame(sessionId);
    }

    function cancelActiveGame(uint256 sessionId) external onlyOwnerOrOperator {
        _cancelActiveGame(sessionId);
    }

    function rescueTokens(address to, uint256 amount) external onlyOwnerOrOperator {
        _rescueTokens(to, amount);
    }

    function getGame(uint256 sessionId) external view returns (GameView memory) {
        return _getGameView(sessionId);
    }
}
