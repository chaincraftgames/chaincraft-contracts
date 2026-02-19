// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { sslot } from "@solidstate/contracts/data/StorageSlot.sol";

/// @title TokenDuelsStorage
/// @dev Namespaced storage for Token Duels betting (EIP-7201 style)
library TokenDuelsStorage {
    /// @custom:storage-location erc7201:chaincraft.layout.TokenDuels
    struct Layout {
        address betToken;
        uint8 betTokenDecimals;

        mapping(uint256 => Game) games; // key is sessionId
    }

    struct Game {
        address p1;
        address p2;
        uint256 stakeAmount; // Token amount (calculated from STAKE_TOKEN_COUNT * 10**decimals)
        uint256 p1Deposit;
        uint256 p2Deposit;
        uint8 state; // uses ITokenDuelsFacet.GameState values
        address winner;
        uint256 gameId; // GameRegistry tokenId - references which game this duel is for
    }

    sslot internal constant DEFAULT_STORAGE_SLOT =
        sslot.wrap(
            keccak256(
                abi.encode(
                    uint256(keccak256(bytes("chaincraft.layout.TokenDuels"))) - 1
                )
            ) & ~bytes32(uint256(0xff))
        );

    function layout() internal pure returns (Layout storage $) {
        $ = layout(DEFAULT_STORAGE_SLOT);
    }

    function layout(sslot slot) internal pure returns (Layout storage $) {
        assembly {
            $.slot := slot
        }
    }
}
