// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _SolidstateNonFungibleToken } from '@solidstate/contracts/token/non_fungible/_SolidstateNonFungibleToken.sol';
import { GameRegistryStorage } from '../GameRegistryFacet/GameRegistryStorage.sol';

/// @title GameMigrationInternal
/// @dev Internal functions for GameMigration functionality - operator-only game publishing
abstract contract GameMigrationInternal is _SolidstateNonFungibleToken {
    
    // ============ Constants ============
    
    /// @dev Expected UUID length (36 characters including hyphens)
    uint256 private constant UUID_LENGTH = 36;
    
    /// @dev Maximum URI length (sufficient for IPFS, HTTPS, and Arweave URIs with buffer)
    uint256 private constant MAX_URI_LENGTH = 1024;

    // ============ Events ============

    /// @notice Emitted when a new game is published (same event as GameRegistryInternal for consistency)
    event GamePublished(
        uint256 indexed tokenId, 
        string indexed uuid, 
        address indexed publisher, 
        string gameURI
    );

    // ============ Errors ============

    error GameMigration__InvalidMintAddress();
    error GameMigration__EmptyURI();
    error GameMigration__EmptyUUID();
    error GameMigration__GameAlreadyExists();
    error GameMigration__InvalidUUIDLength();
    error GameMigration__URITooLong();

    // ============ Internal Functions ============

    /// @notice Publish a new game as an NFT without requiring user signature (operator only)
    /// @dev Only callable by operators/owner. No signature required - use for migrations.
    /// @param uuid Unique identifier for the game (must be UUID v4 format, 36 characters)
    /// @param to Address to mint the game NFT to
    /// @param gameURI URI containing game metadata (max 1024 characters)
    /// @return tokenId The ID of the newly minted game NFT
    function _publishGameByOperator(
        string memory uuid,
        address to,
        string memory gameURI
    ) internal returns (uint256) {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        
        // Address validation
        if (to == address(0)) revert GameMigration__InvalidMintAddress();
        
        // UUID validation
        if (bytes(uuid).length == 0) revert GameMigration__EmptyUUID();
        if (bytes(uuid).length != UUID_LENGTH) revert GameMigration__InvalidUUIDLength();
        if (ds.uuidToTokenId[uuid] != 0) revert GameMigration__GameAlreadyExists();
        
        // URI validation
        if (bytes(gameURI).length == 0) revert GameMigration__EmptyURI();
        if (bytes(gameURI).length > MAX_URI_LENGTH) revert GameMigration__URITooLong();

        uint256 tokenId = ds.nextTokenId;
        ds.nextTokenId++;

        // Store game data before minting
        ds.gameURIs[tokenId] = gameURI;
        ds.uuidToTokenId[uuid] = tokenId;
        ds.tokenIdToUUID[tokenId] = uuid;

        // Mint NFT to recipient
        _mint(to, tokenId);

        // Emit the same event as GameRegistryInternal for consistency
        emit GamePublished(tokenId, uuid, to, gameURI);
        
        return tokenId;
    }
}
