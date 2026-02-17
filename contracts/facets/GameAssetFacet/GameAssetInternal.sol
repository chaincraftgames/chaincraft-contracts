// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _SolidstateNonFungibleToken } from '@solidstate/contracts/token/non_fungible/_SolidstateNonFungibleToken.sol';
import { ERC721Storage } from '@solidstate/contracts/storage/ERC721Storage.sol';
import { _Initializable } from '@solidstate/contracts/access/initializable/_Initializable.sol';
import { GameAssetStorage } from './GameAssetStorage.sol';
import { EIP712Internal } from '../EIP712Facet/EIP712Internal.sol';

/// @title GameAssetInternal
/// @dev Internal functions for Character NFT functionality
abstract contract GameAssetInternal is 
    _SolidstateNonFungibleToken,
    _Initializable,
    EIP712Internal 
{
    
    // ============ Constants ============
    
    /// @dev Maximum URI length (sufficient for IPFS, HTTPS, and Arweave URIs with buffer)
    uint256 private constant MAX_URI_LENGTH = 1024;
    
    /// @dev TypeHash for MintAsset struct
    bytes32 private constant MINT_ASSET_TYPEHASH = keccak256(
        "MintAsset(address to,string tokenURI,uint256 deadline)"
    );

    // ============ Events ============

    /// @notice Emitted when a new character is minted
    event AssetMinted(
        uint256 indexed tokenId, 
        address indexed to, 
        string tokenURI,
        bool indexed isFreeMint
    );

    /// @notice Emitted when a character URI is updated
    event AssetURIUpdated(uint256 indexed tokenId, string newURI);

    // ============ Errors ============

    error GameAsset__InvalidMintAddress();
    error GameAsset__EmptyURI();
    error GameAsset__TokenDoesNotExist();
    error GameAsset__URITooLong();
    error GameAsset__SignerMismatch();

    // ============ Internal Functions ============

    /// @notice Initialize the GameAsset
    /// @dev Can only be called once due to initializer modifier
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    function _initialize(string memory name_, string memory symbol_) internal initializer {
        GameAssetStorage.Layout storage ds = GameAssetStorage.layout();
        
        // Set name and symbol in ERC721Storage
        ERC721Storage.layout().name = name_;
        ERC721Storage.layout().symbol = symbol_;
        ds.nextTokenId = 1; // Start token IDs from 1
        
        // Register ERC721 interface support
        _setSupportsInterface(0x80ac58cd, true); // ERC721
        _setSupportsInterface(0x5b5e139f, true); // ERC721Metadata
        _setSupportsInterface(0x780e9d63, true); // ERC721Enumerable
    }

    /// @notice Mint a new character NFT with EIP-712 signature verification
    /// @dev Requires user signature to prove consent. Operator submits the transaction.
    /// @param to Address to mint the character NFT to (must match signer)
    /// @param tokenURI URI containing character metadata (max 1024 characters)
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the recipient
    /// @return tokenId The ID of the newly minted character NFT
    function _mintWithSignature(
        address to,
        string memory tokenURI,
        uint256 deadline,
        bytes memory signature
    ) internal returns (uint256) {
        GameAssetStorage.Layout storage ds = GameAssetStorage.layout();
        
        // Address validation
        if (to == address(0)) revert GameAsset__InvalidMintAddress();
        
        // URI validation
        if (bytes(tokenURI).length == 0) revert GameAsset__EmptyURI();
        if (bytes(tokenURI).length > MAX_URI_LENGTH) revert GameAsset__URITooLong();

        // Create struct hash for signature verification
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_ASSET_TYPEHASH,
                to,
                keccak256(bytes(tokenURI)),
                deadline
            )
        );

        // Verify signature and recover signer
        address signer = _verifySignatureAndRecover(structHash, deadline, signature);

        // Ensure the signer is the recipient to prevent operator from minting without user consent
        if (signer != to) {
            revert GameAsset__SignerMismatch();
        }

        uint256 tokenId = ds.nextTokenId;
        ds.nextTokenId++;

        // Store token URI
        ds.tokenURIs[tokenId] = tokenURI;

        // Mint NFT to recipient
        _mint(to, tokenId);

        emit AssetMinted(tokenId, to, tokenURI, false);
        
        return tokenId;
    }

    /// @notice Mint a new character NFT directly to a user (operator only, no signature required)
    /// @dev Only callable by operators/owner. No user signature required.
    /// @param to Address to mint the character NFT to
    /// @param tokenURI URI containing character metadata (max 1024 characters)
    /// @return tokenId The ID of the newly minted character NFT
    function _mintTo(
        address to,
        string memory tokenURI
    ) internal returns (uint256) {
        GameAssetStorage.Layout storage ds = GameAssetStorage.layout();
        
        // Address validation
        if (to == address(0)) revert GameAsset__InvalidMintAddress();
        
        // URI validation
        if (bytes(tokenURI).length == 0) revert GameAsset__EmptyURI();
        if (bytes(tokenURI).length > MAX_URI_LENGTH) revert GameAsset__URITooLong();

        uint256 tokenId = ds.nextTokenId;
        ds.nextTokenId++;

        // Store token URI
        ds.tokenURIs[tokenId] = tokenURI;

        // Mint NFT to recipient
        _mint(to, tokenId);

        emit AssetMinted(tokenId, to, tokenURI, true);
        
        return tokenId;
    }

    /// @notice Update character URI with EIP-712 signature verification
    /// @dev Requires owner signature to prove consent. Operator submits the transaction.
    /// @param tokenId The character NFT token ID
    /// @param newURI New URI for the character (max 1024 characters)
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature from the token owner
    function _updateTokenURI(
        uint256 tokenId,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) internal {
        if (!_exists(tokenId)) revert GameAsset__TokenDoesNotExist();
        
        // URI validation
        if (bytes(newURI).length == 0) revert GameAsset__EmptyURI();
        if (bytes(newURI).length > MAX_URI_LENGTH) revert GameAsset__URITooLong();
        
        // Get the token owner
        address owner = _ownerOf(tokenId);
        
        // Create struct hash for signature verification
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_ASSET_TYPEHASH, // Reuse the same typehash for simplicity
                owner,
                keccak256(bytes(newURI)),
                deadline
            )
        );

        // Verify signature and recover signer
        address signer = _verifySignatureAndRecover(structHash, deadline, signature);

        // Ensure the signer is the token owner to prevent unauthorized updates
        if (signer != owner) {
            revert GameAsset__SignerMismatch();
        }
        
        GameAssetStorage.layout().tokenURIs[tokenId] = newURI;
        emit AssetURIUpdated(tokenId, newURI);
    }

    /// @notice Update character URI by operator without requiring owner signature
    /// @dev Only callable by operators/owner. No signature required.
    /// @param tokenId The character NFT token ID
    /// @param newURI New URI for the character (max 1024 characters)
    function _updateTokenURIByOperator(
        uint256 tokenId,
        string memory newURI
    ) internal {
        if (!_exists(tokenId)) revert GameAsset__TokenDoesNotExist();
        
        // URI validation
        if (bytes(newURI).length == 0) revert GameAsset__EmptyURI();
        if (bytes(newURI).length > MAX_URI_LENGTH) revert GameAsset__URITooLong();
        
        GameAssetStorage.layout().tokenURIs[tokenId] = newURI;
        emit AssetURIUpdated(tokenId, newURI);
    }

    /// @notice Get the token URI for a character
    /// @param tokenId The token ID
    /// @return The token URI
    function _getTokenURI(uint256 tokenId) internal view returns (string memory) {
        if (!_exists(tokenId)) revert GameAsset__TokenDoesNotExist();
        return GameAssetStorage.layout().tokenURIs[tokenId];
    }

    // ============ Override Functions ============

    /// @notice Override _tokenURI to use our custom token URIs
    /// @param tokenId The token ID
    /// @return The token URI
    function _tokenURI(uint256 tokenId) internal view override returns (string memory) {
        return _getTokenURI(tokenId);
    }
}
