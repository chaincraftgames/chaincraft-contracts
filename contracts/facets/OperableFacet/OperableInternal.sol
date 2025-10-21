// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EnumerableSet } from '@solidstate/contracts/data/EnumerableSet.sol';
import './OperableStorage.sol';

/// @title OperableInternal
/// @dev Internal functions for operator management
/// @dev This contract should be inherited by facets that need to check operator status
abstract contract OperableInternal {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ Events ============

    /// @notice Emitted when an operator is added
    /// @param operator Address of the added operator
    event OperatorAdded(address indexed operator);

    /// @notice Emitted when an operator is removed
    /// @param operator Address of the removed operator
    event OperatorRemoved(address indexed operator);

    // ============ Internal Functions ============

    /// @notice Add an operator
    /// @dev Internal function to add an operator to the set
    /// @param operator Address to be added as an operator
    function _addOperator(address operator) internal {
        OperableStorage.layout().operators.add(operator);
        emit OperatorAdded(operator);
    }

    /// @notice Remove an operator
    /// @dev Internal function to remove an operator from the set
    /// @param operator Address to be removed from operators
    function _removeOperator(address operator) internal {
        OperableStorage.layout().operators.remove(operator);
        emit OperatorRemoved(operator);
    }

    /// @notice Check if an address is an operator
    /// @dev Internal function to check operator status
    /// @param operator Address to check
    /// @return bool True if the address is an operator
    function _isOperator(address operator) internal view returns (bool) {
        return OperableStorage.layout().operators.contains(operator);
    }

    /// @notice Get all operators
    /// @dev Internal function to retrieve all operators
    /// @return address[] Array of all operator addresses
    function _getOperators() internal view returns (address[] memory) {
        return OperableStorage.layout().operators.toArray();
    }
}
