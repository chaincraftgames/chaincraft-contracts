// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGameRegistryFacet
/// @dev Interface for GameRegistryFacet - game publishing and management as NFTs
interface IGameRegistryFacet {
    
    // ============ Functions ============

    /// @notice Initialize the GameRegistry
    /// @param name Token name
    /// @param symbol Token symbol
    function initialize(string memory name, string memory symbol) external;

    /// @notice Publish a new game as an NFT
    /// @param uuid Unique identifier for the game (from your app)
    /// @param to Address to mint the game NFT to
    /// @param gameURI URI containing game metadata
    /// @return tokenId The ID of the newly minted game NFT
    function publishGame(
        string memory uuid,
        address to, 
        string memory gameURI
    ) external returns (uint256);

    /// @notice Update the URI for an existing game by token ID
    /// @param tokenId The game NFT token ID
    /// @param newURI New URI for the game
    function updateGameURI(uint256 tokenId, string memory newURI) external;

    /// @notice Update the URI for an existing game by UUID
    /// @param uuid The game UUID
    /// @param newURI New URI for the game
    function updateGameURIByUUID(string memory uuid, string memory newURI) external;

    /// @notice Get token ID by UUID
    /// @param uuid The game UUID
    /// @return tokenId The token ID (0 if not found)
    function getTokenIdByUUID(string memory uuid) external view returns (uint256);

    /// @notice Get UUID by token ID
    /// @param tokenId The token ID
    /// @return uuid The game UUID
    function getUUIDByTokenId(uint256 tokenId) external view returns (string memory);

    /// @notice Check if a game with UUID exists
    /// @param uuid The game UUID
    /// @return exists True if game exists
    function gameExists(string memory uuid) external view returns (bool);

    /// @notice Get total number of games published
    /// @return The total number of games
    function totalGames() external view returns (uint256);
}
