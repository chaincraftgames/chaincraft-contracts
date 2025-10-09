// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeOwnable} from "@solidstate/contracts/access/ownable/safe/SafeOwnable.sol";
import { sslot } from '@solidstate/contracts/data/StorageSlot.sol';

/**
 * @title SimpleMockFacet
 * @dev A simple mock facet for testing diamond functionality
 * @dev Follows the EXACT same pattern as GameRegistryFacet
 */
contract SimpleMockFacet is SafeOwnable {
    
    // ============ Storage Layout ============
    
    /**
     * @custom:storage-location erc7201:chaincraft.layout.SimpleMockFacet
     */
    struct Layout {
        uint256 value;
    }

    sslot internal constant DEFAULT_STORAGE_SLOT =
        sslot.wrap(
            keccak256(
                abi.encode(
                    uint256(keccak256(bytes('chaincraft.layout.SimpleMockFacet'))) - 1
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
    
    // ============ Events ============
    
    event ValueSet(uint256 value);
    
    // ============ External Functions ============
    
    /**
     * @dev Set a value
     * @param value The value to set
     */
    function setValue(uint256 value) external onlyOwner {
        Layout storage ds = layout();
        ds.value = value;
        emit ValueSet(value);
    }
    
    /**
     * @dev Get the stored value
     * @return The stored value
     */
    function getValue() external view returns (uint256) {
        Layout storage ds = layout();
        return ds.value;
    }
    
    /**
     * @dev Get a constant value
     * @return Always returns 42
     */
    function getConstant() external pure returns (uint256) {
        return 42;
    }
}
