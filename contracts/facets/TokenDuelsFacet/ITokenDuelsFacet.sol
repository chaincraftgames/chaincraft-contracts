// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITokenDuelsFacet
/// @dev Interface for ChainCraft Token Duels betting (2-player, fixed stake, ERC20 token)
interface ITokenDuelsFacet {
    // ============ Enums ============

    enum GameState {
        NONE,
        WAITING_FOR_P2,
        ACTIVE,
        FINISHED,
        CANCELED
    }

    // ============ Structs ============

    struct GameView {
        address p1;
        address p2;
        uint256 stakeAmount;
        uint256 p1Deposit;
        uint256 p2Deposit;
        GameState state;
        address winner;
        uint256 gameId; // GameRegistry tokenId - references which game this duel is for
    }

    // ============ Events ============

    event GameCreated(uint256 indexed sessionId, uint256 gameId, address indexed p1, uint256 stakeAmount);
    event GameJoined(uint256 indexed sessionId, address indexed p2);
    event GameSettled(uint256 indexed sessionId, address indexed winner, uint256 payoutAmount);
    event GameCanceled(uint256 indexed sessionId);
    event Rescue(address indexed to, uint256 amount);

    // ============ Functions ============

    function stakeAmount() external view returns (uint256);

    function configureToken(address token) external;

    function configuredToken() external view returns (address token, uint8 decimals);

    function createGame(uint256 sessionId, uint256 gameId) external;

    function createGameWithSignature(
        uint256 sessionId,
        uint256 gameId,
        address userAddress,
        uint256 deadline,
        bytes memory signature
    ) external;

    function joinGame(uint256 sessionId) external;

    function joinGameWithSignature(
        uint256 sessionId,
        address userAddress,
        uint256 deadline,
        bytes memory signature
    ) external;

    function settleGame(uint256 sessionId, address winner) external;

    function cancelWaitingGame(uint256 sessionId) external;

    function cancelActiveGame(uint256 sessionId) external;

    function rescueTokens(address to, uint256 amount) external;

    function getGame(uint256 sessionId) external view returns (GameView memory);
}
