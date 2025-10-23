// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _Proxy } from "@solidstate/contracts/proxy/_Proxy.sol";

/**
 * @title ProxyAdminFacet
 * @notice Facet to manage ERC-1967 proxy admin transfers for the Diamond
 * @dev This facet provides the missing proxy admin transfer functionality
 *      that SolidstateDiamondProxy doesn't include by default (see TODO at line 85)
 * 
 * SECURITY: Only the current proxy admin can call transferProxyAdmin()
 * 
 * USAGE:
 * 1. Add this facet to the diamond after initial deployment
 * 2. Transfer proxy admin to the target address
 * 3. (Optional) Remove this facet to make proxy admin immutable
 */
contract ProxyAdminFacet is _Proxy {
    /// @notice Emitted when proxy admin is transferred
    event ProxyAdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );

    /// @notice Thrown when trying to set admin to zero address
    error ProxyAdminFacet__ZeroAddress();

    /**
     * @notice Get the current ERC-1967 proxy admin address
     * @return admin address of current proxy admin
     * @dev This reads from the ERC-1967 admin storage slot
     */
    function getProxyAdmin() external view returns (address admin) {
        admin = _getProxyAdmin();
    }

    /**
     * @notice Transfer proxy admin rights to a new address
     * @param newAdmin address of new proxy admin
     * @dev Only callable by current proxy admin due to onlyProxyAdmin modifier
     * @dev Reverts if newAdmin is zero address
     */
    function transferProxyAdmin(address newAdmin) external onlyProxyAdmin {
        if (newAdmin == address(0)) {
            revert ProxyAdminFacet__ZeroAddress();
        }

        address oldAdmin = _getProxyAdmin();
        _setProxyAdmin(newAdmin);

        emit ProxyAdminTransferred(oldAdmin, newAdmin);
    }
}

