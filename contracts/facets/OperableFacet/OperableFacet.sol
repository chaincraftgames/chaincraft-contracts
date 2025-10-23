// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _Ownable } from '@solidstate/contracts/access/ownable/_Ownable.sol';
import { IOperable } from './IOperable.sol';
import { OperableInternal } from './OperableInternal.sol';

/// @title OperableFacet
/// @dev Facet for operator management in Diamond pattern
/// @dev Provides external functions for adding/removing operators and checking operator status
contract OperableFacet is OperableInternal, IOperable, _Ownable {
    
    /// @notice Add a new operator
    /// @dev Only callable by the contract owner
    /// @param operator Address to be added as an operator
    function addOperator(address operator) external override onlyOwner {
        _addOperator(operator);
    }

    /// @notice Remove an existing operator
    /// @dev Only callable by the contract owner
    /// @param operator Address to be removed from operators
    function removeOperator(address operator) external override onlyOwner {
        _removeOperator(operator);
    }

    /// @notice Check if an address is an operator
    /// @param operator Address to check
    /// @return bool True if the address is an operator, false otherwise
    function isOperator(address operator) external view override returns (bool) {
        return _isOperator(operator);
    }

    /// @notice Get all operators
    /// @return address[] Array of all operator addresses
    function getOperators() external view returns (address[] memory) {
        return _getOperators();
    }
}
