// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { sslot } from '@solidstate/contracts/data/StorageSlot.sol';
import { EnumerableSet } from '@solidstate/contracts/data/EnumerableSet.sol';

/// @title OperableStorage
/// @dev Storage layout for Operable functionality using EIP-7201 namespaced storage
/// @dev This ensures storage isolation and prevents collisions in the Diamond pattern
library OperableStorage {
    
    // ============ Storage Layout ============

    /// @custom:storage-location erc7201:chaincraft.layout.Operable
    struct Layout {
        EnumerableSet.AddressSet operators;
    }

    // ============ Storage Slot ============

    /// @dev Storage slot for Operable layout
    /// @dev Calculated using EIP-7201 formula: keccak256(abi.encode(uint256(keccak256("chaincraft.layout.Operable")) - 1)) & ~bytes32(uint256(0xff))
    sslot internal constant DEFAULT_STORAGE_SLOT =
        sslot.wrap(
            keccak256(
                abi.encode(
                    uint256(keccak256(bytes('chaincraft.layout.Operable'))) - 1
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
