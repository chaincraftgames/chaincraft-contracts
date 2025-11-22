// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _SolidstateNonFungibleToken } from '@solidstate/contracts/token/non_fungible/_SolidstateNonFungibleToken.sol';
import { ERC721Storage } from '@solidstate/contracts/storage/ERC721Storage.sol';
import { _Initializable } from '@solidstate/contracts/access/initializable/_Initializable.sol';
import { GameRegistryStorage } from './GameRegistryStorage.sol';
import { EIP712Internal } from '../EIP712Facet/EIP712Internal.sol';

/// @title GameRegistryInternal
/// @dev Internal functions for GameRegistry functionality
abstract contract GameRegistryInternal is 
    _SolidstateNonFungibleToken,
    _Initializable,
    EIP712Internal 
{
    
    // ============ Constants ============
    
    /// @dev Exact length for UUID v4 format (RFC 4122): xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    uint256 private constant UUID_LENGTH = 36;
    
    /// @dev Maximum URI length (sufficient for IPFS, HTTPS, and Arweave URIs with buffer)
    uint256 private constant MAX_URI_LENGTH = 1024;
    
    /// @dev TypeHash for PublishGame struct
    bytes32 private constant PUBLISH_GAME_TYPEHASH = keccak256(
        "PublishGame(string uuid,address to,string gameURI,uint256 deadline)"
    );

    /// @dev TypeHash for UpdateGameURI struct
    bytes32 private constant UPDATE_GAME_URI_TYPEHASH = keccak256(
        "UpdateGameURI(string uuid,string newURI,uint256 deadline)"
    );

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
    error GameRegistry__TokenDoesNotExist();
    error GameRegistry__URICannotBeEmpty();
    error GameRegistry__GameAlreadyExists();
    error GameRegistry__GameNotFound();
    error GameRegistry__SignerMismatch();
    error GameRegistry__InvalidUUIDLength();
    error GameRegistry__URITooLong();

    // ============ Internal Functions ============

    /// @notice Initialize the GameRegistry
    /// @dev Can only be called once due to initializer modifier
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    function _initialize(string memory name_, string memory symbol_) internal initializer {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        
        // Set name and symbol in ERC721Storage
        ERC721Storage.layout().name = name_;
        ERC721Storage.layout().symbol = symbol_;
        ds.nextTokenId = 1; // Start token IDs from 1
        
        // Register ERC721 interface support
        _setSupportsInterface(0x80ac58cd, true); // ERC721
        _setSupportsInterface(0x5b5e139f, true); // ERC721Metadata
        _setSupportsInterface(0x780e9d63, true); // ERC721Enumerable
    }

    /// @notice Publish a new game as an NFT with EIP-712 signature verification
    /// @dev Requires user signature to prove consent. Operator submits the transaction.
    /// @param uuid Unique identifier for the game (must be UUID v4 format, 36 characters)
    /// @param to Address to mint the game NFT to (must match signer)
    /// @param gameURI URI containing game metadata (max 1024 characters)
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the recipient
    /// @return tokenId The ID of the newly minted game NFT
    function _publishGame(
        string memory uuid,
        address to,
        string memory gameURI,
        uint256 deadline,
        bytes memory signature
    ) internal returns (uint256) {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        
        // Address validation
        if (to == address(0)) revert GameRegistry__InvalidMintAddress();
        
        // UUID validation
        if (bytes(uuid).length == 0) revert GameRegistry__EmptyUUID();
        if (bytes(uuid).length != UUID_LENGTH) revert GameRegistry__InvalidUUIDLength();
        if (ds.uuidToTokenId[uuid] != 0) revert GameRegistry__GameAlreadyExists();
        
        // URI validation
        if (bytes(gameURI).length == 0) revert GameRegistry__EmptyURI();
        if (bytes(gameURI).length > MAX_URI_LENGTH) revert GameRegistry__URITooLong();

        // Create struct hash for signature verification
        bytes32 structHash = keccak256(
            abi.encode(
                PUBLISH_GAME_TYPEHASH,
                keccak256(bytes(uuid)),
                to,
                keccak256(bytes(gameURI)),
                deadline
            )
        );

        // Verify signature and recover signer
        address signer = _verifySignatureAndRecover(structHash, deadline, signature);

        // Ensure the signer is the recipient to prevent operator from minting without user consent
        if (signer != to) {
            revert GameRegistry__SignerMismatch();
        }

        uint256 tokenId = ds.nextTokenId;
        ds.nextTokenId++;

        // Store game data before minting
        ds.gameURIs[tokenId] = gameURI;
        ds.uuidToTokenId[uuid] = tokenId;
        ds.tokenIdToUUID[tokenId] = uuid;

        // Mint NFT to recipient
        _mint(to, tokenId);

        emit GamePublished(tokenId, uuid, to, gameURI);
        
        return tokenId;
    }

    /// @notice Update game URI for an existing game with EIP-712 signature verification
    /// @dev Requires owner signature to prove consent. Operator submits the transaction.
    /// @param tokenId The game NFT token ID
    /// @param newURI New URI for the game (max 1024 characters)
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the token owner
    function _updateGameURI(
        uint256 tokenId,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) internal {
        if (!_exists(tokenId)) revert GameRegistry__TokenDoesNotExist();
        
        // URI validation
        if (bytes(newURI).length == 0) revert GameRegistry__URICannotBeEmpty();
        if (bytes(newURI).length > MAX_URI_LENGTH) revert GameRegistry__URITooLong();
        
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        string memory uuid = ds.tokenIdToUUID[tokenId];
        
        // Get the token owner
        address owner = _ownerOf(tokenId);
        
        // Create struct hash for signature verification
        bytes32 structHash = keccak256(
            abi.encode(
                UPDATE_GAME_URI_TYPEHASH,
                keccak256(bytes(uuid)),
                keccak256(bytes(newURI)),
                deadline
            )
        );

        // Verify signature and recover signer
        address signer = _verifySignatureAndRecover(structHash, deadline, signature);

        // Ensure the signer is the token owner to prevent unauthorized updates
        if (signer != owner) {
            revert GameRegistry__SignerMismatch();
        }
        
        ds.gameURIs[tokenId] = newURI;
        emit GameURIUpdated(tokenId, uuid, newURI);
    }

    /// @notice Update game URI by UUID with EIP-712 signature verification
    /// @param uuid The game UUID (must be UUID v4 format, 36 characters)
    /// @param newURI New URI for the game (max 1024 characters)
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the token owner
    function _updateGameURIByUUID(
        string memory uuid,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) internal {
        // UUID validation
        if (bytes(uuid).length != UUID_LENGTH) revert GameRegistry__InvalidUUIDLength();
        
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        uint256 tokenId = ds.uuidToTokenId[uuid];
        
        if (tokenId == 0) revert GameRegistry__GameNotFound();
        
        _updateGameURI(tokenId, newURI, deadline, signature);
    }

    /// @notice Update game URI by operator without requiring owner signature
    /// @dev Only callable by operators/owner. No signature required.
    /// @param tokenId The game NFT token ID
    /// @param newURI New URI for the game (max 1024 characters)
    function _updateGameURIByOperator(
        uint256 tokenId,
        string memory newURI
    ) internal {
        if (!_exists(tokenId)) revert GameRegistry__TokenDoesNotExist();
        
        // URI validation
        if (bytes(newURI).length == 0) revert GameRegistry__URICannotBeEmpty();
        if (bytes(newURI).length > MAX_URI_LENGTH) revert GameRegistry__URITooLong();
        
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        string memory uuid = ds.tokenIdToUUID[tokenId];
        
        ds.gameURIs[tokenId] = newURI;
        emit GameURIUpdated(tokenId, uuid, newURI);
    }

    /// @notice Update game URI by UUID by operator without requiring owner signature
    /// @dev Only callable by operators/owner. No signature required.
    /// @param uuid The game UUID (must be UUID v4 format, 36 characters)
    /// @param newURI New URI for the game (max 1024 characters)
    function _updateGameURIByUUIDByOperator(
        string memory uuid,
        string memory newURI
    ) internal {
        // UUID validation
        if (bytes(uuid).length != UUID_LENGTH) revert GameRegistry__InvalidUUIDLength();
        
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        uint256 tokenId = ds.uuidToTokenId[uuid];
        
        if (tokenId == 0) revert GameRegistry__GameNotFound();
        
        _updateGameURIByOperator(tokenId, newURI);
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

    // ============ Override Functions ============

    /// @notice Override _tokenURI to use our custom game URIs
    /// @param tokenId The token ID
    /// @return The token URI
    function _tokenURI(uint256 tokenId) internal view override returns (string memory) {
        return _getGameURI(tokenId);
    }
}
