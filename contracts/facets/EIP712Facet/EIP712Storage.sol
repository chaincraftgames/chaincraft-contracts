// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { sslot } from '@solidstate/contracts/data/StorageSlot.sol';

/// @title EIP712Storage
/// @dev Centralized storage for EIP-712 signature verification
library EIP712Storage {
    
    /// @custom:storage-location erc7201:chaincraft.layout.EIP712
    struct Layout {
        /// @dev Track used signatures to prevent replay attacks
        mapping(bytes32 => bool) usedSignatures;
    }

    /// @dev Storage slot for EIP712 layout
    /// @dev Calculated using EIP-7201 formula
    sslot internal constant DEFAULT_STORAGE_SLOT =
        sslot.wrap(
            keccak256(
                abi.encode(
                    uint256(keccak256(bytes('chaincraft.layout.EIP712'))) - 1
                )
            ) & ~bytes32(uint256(0xff))
        );

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
