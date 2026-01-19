// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGameMigrationFacet
/// @dev Interface for GameMigrationFacet - operator-only game publishing for migrations
interface IGameMigrationFacet {
    
    /// @notice Publish a new game as an NFT without requiring user signature (operator only)
    /// @dev Only callable by operators/owner. No signature required - use for migrations.
    /// @param uuid Unique identifier for the game (must be UUID v4 format, 36 characters)
    /// @param to Address to mint the game NFT to
    /// @param gameURI URI containing game metadata (max 1024 characters)
    /// @return tokenId The ID of the newly minted game NFT
    function publishGameByOperator(
        string memory uuid,
        address to,
        string memory gameURI
    ) external returns (uint256);
}
