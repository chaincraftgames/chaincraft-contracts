// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ReentrancyGuard } from "solady/src/utils/ReentrancyGuard.sol";
import { SafeTransferLib } from "solady/src/utils/SafeTransferLib.sol";
import { TokenDuelsStorage } from "./TokenDuelsStorage.sol";
import { ITokenDuelsFacet } from "./ITokenDuelsFacet.sol";

/// @title TokenDuelsInternal
/// @dev Internal logic for Token Duels (ERC20 token, fixed stake)
abstract contract TokenDuelsInternal is ITokenDuelsFacet, ReentrancyGuard {
    // ============ Constants ============

    uint256 internal constant STAKE_TOKEN_COUNT = 10; // Base token count (multiplied by 10**decimals)

    // ============ Errors ============

    error TokenDuels__InvalidStake();
    error TokenDuels__InvalidGameId();
    error TokenDuels__WrongState();
    error TokenDuels__AlreadyJoined();
    error TokenDuels__CannotJoinSelf();
    error TokenDuels__InvalidWinner();
    error TokenDuels__ZeroAddress();
    error TokenDuels__InvalidToken();
    error TokenDuels__TokenNotSet();
    error TokenDuels__SessionIdExists();

    function _getGame(uint256 sessionId) internal view returns (TokenDuelsStorage.Game storage game) {
        game = TokenDuelsStorage.layout().games[sessionId];
        if (game.p1 == address(0)) revert TokenDuels__InvalidGameId();
    }

    function _getStakeAmount() internal view returns (uint256) {
        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();
        if (ds.betToken == address(0)) revert TokenDuels__TokenNotSet();
        return STAKE_TOKEN_COUNT * 10 ** ds.betTokenDecimals;
    }

    function _requireTokenSet() internal view {
        if (TokenDuelsStorage.layout().betToken == address(0)) {
            revert TokenDuels__TokenNotSet();
        }
    }

    function _configureToken(address token) internal {
        if (token == address(0)) revert TokenDuels__ZeroAddress();
        
        // Fetch decimals from the ERC20 contract
        uint8 decimals;
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (!success || data.length == 0) {
            revert TokenDuels__InvalidToken();
        }
        decimals = abi.decode(data, (uint8));

        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();
        ds.betToken = token;
        ds.betTokenDecimals = decimals;
    }

    function _getConfiguredToken() internal view returns (address token, uint8 decimals) {
        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();
        return (ds.betToken, ds.betTokenDecimals);
    }

    function _getGameView(uint256 sessionId) internal view returns (ITokenDuelsFacet.GameView memory) {
        TokenDuelsStorage.Game storage game = _getGame(sessionId);

        return ITokenDuelsFacet.GameView({
            p1: game.p1,
            p2: game.p2,
            stakeAmount: game.stakeAmount,
            p1Deposit: game.p1Deposit,
            p2Deposit: game.p2Deposit,
            state: ITokenDuelsFacet.GameState(game.state),
            winner: game.winner,
            gameId: game.gameId
        });
    }

    // ============ Internal Core ============

    function _createGame(uint256 sessionId, uint256 gameId) internal nonReentrant {
        if (sessionId == 0) revert TokenDuels__InvalidGameId();
        if (gameId == 0) revert TokenDuels__InvalidGameId(); // GameRegistry tokenId must be provided
        _requireTokenSet();

        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();
        
        // Check if sessionId already exists
        if (ds.games[sessionId].p1 != address(0)) {
            revert TokenDuels__SessionIdExists();
        }

        uint256 stakeAmount = _getStakeAmount();
        address betToken = ds.betToken;

        // Transfer tokens from player to contract
        SafeTransferLib.safeTransferFrom(betToken, msg.sender, address(this), stakeAmount);

        TokenDuelsStorage.Game storage game = ds.games[sessionId];
        game.p1 = msg.sender;
        game.p2 = address(0);
        game.stakeAmount = stakeAmount;
        game.p1Deposit = stakeAmount;
        game.p2Deposit = 0;
        game.state = 1; // WAITING_FOR_P2
        game.winner = address(0);
        game.gameId = gameId;

        emit GameCreated(sessionId, gameId, msg.sender, stakeAmount);
    }

    function _joinGame(uint256 sessionId) internal nonReentrant {
        _requireTokenSet();

        TokenDuelsStorage.Game storage game = _getGame(sessionId);
        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();

        if (game.state != 1) revert TokenDuels__WrongState(); // WAITING_FOR_P2
        if (game.p2 != address(0)) revert TokenDuels__AlreadyJoined();
        if (msg.sender == game.p1) revert TokenDuels__CannotJoinSelf();

        uint256 stakeAmount = game.stakeAmount;
        address betToken = ds.betToken;

        // Transfer tokens from player to contract
        SafeTransferLib.safeTransferFrom(betToken, msg.sender, address(this), stakeAmount);

        game.p2 = msg.sender;
        game.p2Deposit = stakeAmount;

        game.state = 2; // ACTIVE

        emit GameJoined(sessionId, msg.sender);
    }

    function _settleGame(uint256 sessionId, address winner) internal nonReentrant {
        TokenDuelsStorage.Game storage game = _getGame(sessionId);
        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();

        if (game.state != 2) revert TokenDuels__WrongState(); // ACTIVE
        if (winner != game.p1 && winner != game.p2) revert TokenDuels__InvalidWinner();

        if (game.p1Deposit != game.stakeAmount || game.p2Deposit != game.stakeAmount) revert TokenDuels__WrongState();

        uint256 payout = game.p1Deposit + game.p2Deposit;
        address betToken = ds.betToken;

        game.state = 3; // FINISHED
        game.winner = winner;

        game.p1Deposit = 0;
        game.p2Deposit = 0;

        // Transfer tokens to winner
        SafeTransferLib.safeTransfer(betToken, winner, payout);

        emit GameSettled(sessionId, winner, payout);
    }

    function _cancelWaitingGame(uint256 sessionId) internal nonReentrant {
        TokenDuelsStorage.Game storage game = _getGame(sessionId);
        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();

        if (game.state != 1) revert TokenDuels__WrongState(); // WAITING_FOR_P2

        uint256 refund = game.p1Deposit;
        address betToken = ds.betToken;

        game.state = 4; // CANCELED
        game.p1Deposit = 0;

        // Transfer tokens back to player
        SafeTransferLib.safeTransfer(betToken, game.p1, refund);

        emit GameCanceled(sessionId);
    }

    function _cancelActiveGame(uint256 sessionId) internal nonReentrant {
        TokenDuelsStorage.Game storage game = _getGame(sessionId);
        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();

        if (game.state != 2) revert TokenDuels__WrongState(); // ACTIVE

        uint256 refund1 = game.p1Deposit;
        uint256 refund2 = game.p2Deposit;
        address betToken = ds.betToken;

        game.state = 4; // CANCELED
        game.p1Deposit = 0;
        game.p2Deposit = 0;

        // Transfer tokens back to players
        SafeTransferLib.safeTransfer(betToken, game.p1, refund1);
        SafeTransferLib.safeTransfer(betToken, game.p2, refund2);

        emit GameCanceled(sessionId);
    }

    function _rescueTokens(address to, uint256 amount) internal nonReentrant {
        if (to == address(0)) revert TokenDuels__ZeroAddress();
        _requireTokenSet();

        TokenDuelsStorage.Layout storage ds = TokenDuelsStorage.layout();
        address betToken = ds.betToken;

        // Transfer tokens to rescue address
        SafeTransferLib.safeTransfer(betToken, to, amount);

        emit Rescue(to, amount);
    }
}
