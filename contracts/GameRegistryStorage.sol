// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { sslot } from '@solidstate/contracts/data/StorageSlot.sol';

/**
 * @title GameRegistryStorage
 * @dev Storage layout for GameRegistryFacet using SolidState pattern
 */
library GameRegistryStorage {
    /**
     * @custom:storage-location erc7201:chaincraft.layout.GameRegistry
     */
    struct Layout {
        // Game-specific state
        uint256 nextTokenId;
        mapping(uint256 => string) gameURIs;
    }

    sslot internal constant DEFAULT_STORAGE_SLOT =
        sslot.wrap(
            keccak256(
                abi.encode(
                    uint256(keccak256(bytes('chaincraft.layout.GameRegistry'))) - 1
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
