// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@solidstate/contracts/token/non_fungible/SolidstateNonFungibleToken.sol';
import '@solidstate/contracts/storage/ERC721Storage.sol';
import './GameRegistryStorage.sol';

/// @title GameRegistryInternal
/// @dev Internal functions for GameRegistry functionality
/// @dev Inherits from SolidstateNonFungibleToken for ERC721 base functionality
abstract contract GameRegistryInternal is SolidstateNonFungibleToken {
    
    // ============ Events ============

    /// @notice Emitted when a new game is published
    event GamePublished(
        uint256 indexed tokenId, 
        string indexed uuid, 
        address indexed publisher, 
        string gameURI
    );

    /// @notice Emitted when a game URI is updated
    event GameURIUpdated(uint256 indexed tokenId, string indexed uuid, string newURI);

    // ============ Errors ============

    error GameRegistry__InvalidMintAddress();
    error GameRegistry__EmptyURI();
    error GameRegistry__EmptyUUID();
    error GameRegistry__AlreadyInitialized();
    error GameRegistry__TokenDoesNotExist();
    error GameRegistry__URICannotBeEmpty();
    error GameRegistry__GameAlreadyExists();
    error GameRegistry__GameNotFound();

    // ============ Internal Functions ============

    /// @notice Initialize the GameRegistry
    /// @dev Can only be called once
    /// @param name Token name
    /// @param symbol Token symbol
    function _initialize(string memory name, string memory symbol) internal {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        if (ds.nextTokenId != 0) revert GameRegistry__AlreadyInitialized();
        
        // Set name and symbol in ERC721Storage
        ERC721Storage.layout().name = name;
        ERC721Storage.layout().symbol = symbol;
        ds.nextTokenId = 1; // Start token IDs from 1
        
        // Register ERC721 interface support
        _setSupportsInterface(0x80ac58cd, true); // ERC721
        _setSupportsInterface(0x5b5e139f, true); // ERC721Metadata
        _setSupportsInterface(0x780e9d63, true); // ERC721Enumerable
    }

    /// @notice Publish a new game as an NFT
    /// @param uuid Unique identifier for the game
    /// @param to Address to mint the game NFT to
    /// @param gameURI URI containing game metadata
    /// @return tokenId The ID of the newly minted game NFT
    function _publishGame(
        string memory uuid,
        address to,
        string memory gameURI
    ) internal returns (uint256) {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        
        // Validations
        if (to == address(0)) revert GameRegistry__InvalidMintAddress();
        if (bytes(gameURI).length == 0) revert GameRegistry__EmptyURI();
        if (bytes(uuid).length == 0) revert GameRegistry__EmptyUUID();
        if (ds.uuidToTokenId[uuid] != 0) revert GameRegistry__GameAlreadyExists();

        uint256 tokenId = ds.nextTokenId;
        ds.nextTokenId++;

        // Mint NFT
        _mint(to, tokenId);
        
        // Store game data
        ds.gameURIs[tokenId] = gameURI;
        ds.uuidToTokenId[uuid] = tokenId;
        ds.tokenIdToUUID[tokenId] = uuid;

        emit GamePublished(tokenId, uuid, to, gameURI);
        return tokenId;
    }

    /// @notice Update game URI for an existing game
    /// @param tokenId The game NFT token ID
    /// @param newURI New URI for the game
    function _updateGameURI(uint256 tokenId, string memory newURI) internal {
        if (!_exists(tokenId)) revert GameRegistry__TokenDoesNotExist();
        if (bytes(newURI).length == 0) revert GameRegistry__URICannotBeEmpty();
        
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        ds.gameURIs[tokenId] = newURI;
        
        string memory uuid = ds.tokenIdToUUID[tokenId];
        emit GameURIUpdated(tokenId, uuid, newURI);
    }

    /// @notice Update game URI by UUID
    /// @param uuid The game UUID
    /// @param newURI New URI for the game
    function _updateGameURIByUUID(string memory uuid, string memory newURI) internal {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        uint256 tokenId = ds.uuidToTokenId[uuid];
        
        if (tokenId == 0) revert GameRegistry__GameNotFound();
        
        _updateGameURI(tokenId, newURI);
    }

    /// @notice Get the token URI for a game
    /// @param tokenId The token ID
    /// @return The token URI
    function _getGameURI(uint256 tokenId) internal view returns (string memory) {
        if (!_exists(tokenId)) revert GameRegistry__TokenDoesNotExist();
        return GameRegistryStorage.layout().gameURIs[tokenId];
    }

    /// @notice Get token ID by UUID
    /// @param uuid The game UUID
    /// @return tokenId The token ID (0 if not found)
    function _getTokenIdByUUID(string memory uuid) internal view returns (uint256) {
        return GameRegistryStorage.layout().uuidToTokenId[uuid];
    }

    /// @notice Get UUID by token ID
    /// @param tokenId The token ID
    /// @return uuid The game UUID
    function _getUUIDByTokenId(uint256 tokenId) internal view returns (string memory) {
        if (!_exists(tokenId)) revert GameRegistry__TokenDoesNotExist();
        return GameRegistryStorage.layout().tokenIdToUUID[tokenId];
    }

    /// @notice Check if a game with UUID exists
    /// @param uuid The game UUID
    /// @return exists True if game exists
    function _gameExists(string memory uuid) internal view returns (bool) {
        return GameRegistryStorage.layout().uuidToTokenId[uuid] != 0;
    }

    /// @notice Get total number of games published
    /// @return The total number of games
    function _totalGames() internal view returns (uint256) {
        return GameRegistryStorage.layout().nextTokenId - 1;
    }

    /// @notice Check if caller is the token owner
    /// @param tokenId The token ID to check
    /// @return True if caller is the token owner
    function _isTokenOwner(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) == msg.sender;
    }

    // ============ Override Functions ============

    /// @notice Override _tokenURI to use our custom game URIs
    /// @param tokenId The token ID
    /// @return The token URI
    function _tokenURI(uint256 tokenId) internal view override returns (string memory) {
        return _getGameURI(tokenId);
    }
}
