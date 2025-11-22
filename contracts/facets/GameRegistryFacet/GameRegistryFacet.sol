// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _Ownable } from '@solidstate/contracts/access/ownable/_Ownable.sol';
import { OperableInternal } from '../OperableFacet/OperableInternal.sol';
import { GameRegistryInternal } from './GameRegistryInternal.sol';
import { GameRegistryStorage } from './GameRegistryStorage.sol';
import { IGameRegistryFacet } from './IGameRegistryFacet.sol';

/// @title GameRegistryFacet
/// @dev Facet for publishing and managing games as NFTs with UUID tracking
contract GameRegistryFacet is GameRegistryInternal, OperableInternal, _Ownable, IGameRegistryFacet {

    // ============ Errors ============
    
    error GameRegistryFacet__NotOperator();

    // ============ Modifiers ============

    modifier onlyOwnerOrOperator() {
        if (msg.sender != _owner() && !_isOperator(msg.sender)) 
            revert GameRegistryFacet__NotOperator();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IGameRegistryFacet
    function initialize(string memory name_, string memory symbol_) external onlyOwner {
        _initialize(name_, symbol_);
    }

    /// @inheritdoc IGameRegistryFacet
    function publishGame(
        string memory uuid,
        address to,
        string memory gameURI,
        uint256 deadline,
        bytes memory signature
    ) external onlyOwnerOrOperator returns (uint256) {
        return _publishGame(uuid, to, gameURI, deadline, signature);
    }

    /// @inheritdoc IGameRegistryFacet
    function updateGameURI(
        uint256 tokenId,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) external onlyOwnerOrOperator {
        _updateGameURI(tokenId, newURI, deadline, signature);
    }

    /// @inheritdoc IGameRegistryFacet
    function updateGameURIByUUID(
        string memory uuid,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) external onlyOwnerOrOperator {
        _updateGameURIByUUID(uuid, newURI, deadline, signature);
    }

    /// @inheritdoc IGameRegistryFacet
    function updateGameURIByOperator(
        uint256 tokenId,
        string memory newURI
    ) external onlyOwnerOrOperator {
        _updateGameURIByOperator(tokenId, newURI);
    }

    /// @inheritdoc IGameRegistryFacet
    function updateGameURIByUUIDByOperator(
        string memory uuid,
        string memory newURI
    ) external onlyOwnerOrOperator {
        _updateGameURIByUUIDByOperator(uuid, newURI);
    }

    /// @inheritdoc IGameRegistryFacet
    function getTokenIdByUUID(string memory uuid) external view returns (uint256) {
        return _getTokenIdByUUID(uuid);
    }

    /// @inheritdoc IGameRegistryFacet
    function getUUIDByTokenId(uint256 tokenId) external view returns (string memory) {
        return _getUUIDByTokenId(tokenId);
    }

    /// @inheritdoc IGameRegistryFacet
    function gameExists(string memory uuid) external view returns (bool) {
        return _gameExists(uuid);
    }

    /// @inheritdoc IGameRegistryFacet
    function totalGames() external view returns (uint256) {
        return _totalGames();
    }

    // ============ ERC721 Standard Functions ============
    // These are inherited from SolidstateNonFungibleToken and automatically
    // exposed as external functions. Your deployment script will register them.

    // The following functions are available because GameRegistryInternal 
    // inherits from _SolidstateNonFungibleToken which inherits from:
    // - _NonFungibleToken (core ERC721)
    // - _NonFungibleTokenEnumerable (enumerable extension)  
    // - _NonFungibleTokenMetadata (metadata extension)
    
    // However, since we're inheriting the INTERNAL version (_SolidstateNonFungibleToken),
    // we need to manually expose the external functions we want:

    // ERC721 Core Functions
    function balanceOf(address account) external view returns (uint256) {
        return _balanceOf(account);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _ownerOf(tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external payable {
        _transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external payable {
        _safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) external payable {
        _safeTransferFrom(from, to, tokenId, data);
    }

    function approve(address operator, uint256 tokenId) external payable {
        _approve(operator, tokenId);
    }

    function setApprovalForAll(address operator, bool status) external {
        _setApprovalForAll(operator, status);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return _getApproved(tokenId);
    }

    function isApprovedForAll(
        address account,
        address operator
    ) external view returns (bool) {
        return _isApprovedForAll(account, operator);
    }

    // ERC721 Metadata Functions
    function name() external view returns (string memory) {
        return _name();
    }

    function symbol() external view returns (string memory) {
        return _symbol();
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return _tokenURI(tokenId);
    }

    // ERC721 Enumerable Functions
    function totalSupply() external view returns (uint256) {
        return _totalSupply();
    }

    function tokenByIndex(uint256 index) external view returns (uint256) {
        return _tokenByIndex(index);
    }

    function tokenOfOwnerByIndex(
        address owner,
        uint256 index
    ) external view returns (uint256) {
        return _tokenOfOwnerByIndex(owner, index);
    }

    // ERC165 Introspection
    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return _supportsInterface(interfaceId);
    }
}
