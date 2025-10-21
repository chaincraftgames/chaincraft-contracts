// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { sslot } from '@solidstate/contracts/data/StorageSlot.sol';

/// @title GameRegistryStorage
/// @dev Storage layout for GameRegistry functionality using EIP-7201 namespaced storage
library GameRegistryStorage {
    
    // ============ Storage Layout ============

    /// @custom:storage-location erc7201:chaincraft.layout.GameRegistry
    struct Layout {
        uint256 nextTokenId;
        mapping(uint256 => string) gameURIs;
        // UUID mappings
        mapping(string => uint256) uuidToTokenId;  // UUID => Token ID
        mapping(uint256 => string) tokenIdToUUID;  // Token ID => UUID
    }

    // ============ Storage Slot ============

    /// @dev Storage slot for GameRegistry layout
    /// @dev Calculated using EIP-7201 formula
    sslot internal constant DEFAULT_STORAGE_SLOT =
        sslot.wrap(
            keccak256(
                abi.encode(
                    uint256(keccak256(bytes('chaincraft.layout.GameRegistry'))) - 1
                )
            ) & ~bytes32(uint256(0xff))
        );

    // ============ Storage Access ============

    /// @notice Get the storage layout at the default slot
    /// @return $ Storage layout reference
    function layout() internal pure returns (Layout storage $) {
        $ = layout(DEFAULT_STORAGE_SLOT);
    }

    /// @notice Get the storage layout at a specific slot
    /// @param slot The storage slot to access
    /// @return $ Storage layout reference
    function layout(sslot slot) internal pure returns (Layout storage $) {
        assembly {
            $.slot := slot
        }
    }
}
