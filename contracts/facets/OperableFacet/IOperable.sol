// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOperable
/// @dev Interface for operator management functionality
interface IOperable {
    
    // ============ Functions ============

    /// @notice Add a new operator
    /// @dev Only callable by the contract owner
    /// @param operator Address to be added as an operator
    function addOperator(address operator) external;

    /// @notice Remove an existing operator
    /// @dev Only callable by the contract owner
    /// @param operator Address to be removed from operators
    function removeOperator(address operator) external;

    /// @notice Check if an address is an operator
    /// @param operator Address to check
    /// @return bool True if the address is an operator, false otherwise
    function isOperator(address operator) external view returns (bool);

    /// @notice Get all operators
    /// @return address[] Array of all operator addresses
    function getOperators() external view returns (address[] memory);
}
