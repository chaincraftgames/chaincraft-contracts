// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGameAssetFacet
/// @dev Interface for GameAssetFacet - character minting as NFTs
interface IGameAssetFacet {
    
    // ============ Functions ============

    /// @notice Initialize the GameAsset
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    function initialize(string memory name_, string memory symbol_) external;

    /// @notice Mint a new character NFT with EIP-712 signature verification
    /// @dev Requires user signature to prove consent. Operator submits the transaction.
    /// @param to Address to mint the character NFT to (must match signature signer)
    /// @param tokenURI URI containing character metadata
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the recipient
    /// @return tokenId The ID of the newly minted character NFT
    function mintWithSignature(
        address to,
        string memory tokenURI,
        uint256 deadline,
        bytes memory signature
    ) external returns (uint256);

    /// @notice Mint a new character NFT directly to a user (operator only, no signature required)
    /// @dev Only callable by operators/owner. No user signature required.
    /// @param to Address to mint the character NFT to
    /// @param tokenURI URI containing character metadata
    /// @return tokenId The ID of the newly minted character NFT
    function mintTo(
        address to,
        string memory tokenURI
    ) external returns (uint256);

    /// @notice Update the URI for an existing character with EIP-712 signature verification
    /// @dev Requires token owner signature to prove consent. Operator submits the transaction.
    /// @param tokenId The character NFT token ID
    /// @param newURI New URI for the character
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the token owner
    function updateTokenURI(
        uint256 tokenId,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) external;

    /// @notice Update the URI for an existing character (operator only, no signature required)
    /// @dev Only callable by operators/owner. No token owner signature required.
    /// @param tokenId The character NFT token ID
    /// @param newURI New URI for the character
    function updateTokenURIByOperator(
        uint256 tokenId,
        string memory newURI
    ) external;
}
