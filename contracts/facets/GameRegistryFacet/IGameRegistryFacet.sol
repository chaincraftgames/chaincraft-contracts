// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGameRegistryFacet
/// @dev Interface for GameRegistryFacet - game publishing and management as NFTs
interface IGameRegistryFacet {
    
    // ============ Functions ============

    /// @notice Initialize the GameRegistry
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    function initialize(string memory name_, string memory symbol_) external;

    /// @notice Publish a new game as an NFT with EIP-712 signature verification
    /// @dev Requires user signature to prove consent. Operator submits the transaction.
    /// @param uuid Unique identifier for the game (from your app)
    /// @param to Address to mint the game NFT to (must match signature signer)
    /// @param gameURI URI containing game metadata
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the recipient
    /// @return tokenId The ID of the newly minted game NFT
    function publishGame(
        string memory uuid,
        address to,
        string memory gameURI,
        uint256 deadline,
        bytes memory signature
    ) external returns (uint256);

    /// @notice Update the URI for an existing game by token ID with EIP-712 signature verification
    /// @dev Requires token owner signature to prove consent. Operator submits the transaction.
    /// @param tokenId The game NFT token ID
    /// @param newURI New URI for the game
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the token owner
    function updateGameURI(
        uint256 tokenId,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) external;

    /// @notice Update the URI for an existing game by UUID with EIP-712 signature verification
    /// @dev Requires token owner signature to prove consent. Operator submits the transaction.
    /// @param uuid The game UUID
    /// @param newURI New URI for the game
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the token owner
    function updateGameURIByUUID(
        string memory uuid,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) external;

    /// @notice Update the URI for an existing game by token ID (operator only, no signature required)
    /// @dev Only callable by operators/owner. No token owner signature required.
    /// @param tokenId The game NFT token ID
    /// @param newURI New URI for the game
    function updateGameURIByOperator(
        uint256 tokenId,
        string memory newURI
    ) external;

    /// @notice Update the URI for an existing game by UUID (operator only, no signature required)
    /// @dev Only callable by operators/owner. No token owner signature required.
    /// @param uuid The game UUID
    /// @param newURI New URI for the game
    function updateGameURIByUUIDByOperator(
        string memory uuid,
        string memory newURI
    ) external;

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
