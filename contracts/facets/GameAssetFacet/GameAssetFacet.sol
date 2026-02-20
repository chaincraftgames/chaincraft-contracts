// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _Ownable } from '@solidstate/contracts/access/ownable/_Ownable.sol';
import { OperableInternal } from '../OperableFacet/OperableInternal.sol';
import { GameAssetInternal } from './GameAssetInternal.sol';
import { GameAssetStorage } from './GameAssetStorage.sol';
import { IGameAssetFacet } from './IGameAssetFacet.sol';

/// @title GameAssetFacet
/// @dev Facet for minting and managing character NFTs with different URIs per token
contract GameAssetFacet is GameAssetInternal, OperableInternal, _Ownable, IGameAssetFacet {

    // ============ Errors ============
    
    error GameAssetFacet__NotOperator();

    // ============ Modifiers ============

    modifier onlyOwnerOrOperator() {
        if (msg.sender != _owner() && !_isOperator(msg.sender)) 
            revert GameAssetFacet__NotOperator();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IGameAssetFacet
    function initialize(string memory name_, string memory symbol_) external onlyOwner {
        _initialize(name_, symbol_);
    }

    /// @inheritdoc IGameAssetFacet
    function mintWithSignature(
        address to,
        string memory tokenURI,
        uint256 deadline,
        bytes memory signature
    ) external onlyOwnerOrOperator returns (uint256) {
        return _mintWithSignature(to, tokenURI, deadline, signature, bytes32(0));
    }

    /// @inheritdoc IGameAssetFacet
    function mintWithSignatureAndSession(
        address to,
        string memory tokenURI,
        uint256 deadline,
        bytes memory signature,
        bytes32 sessionId
    ) external onlyOwnerOrOperator returns (uint256) {
        return _mintWithSignature(to, tokenURI, deadline, signature, sessionId);
    }

    /// @inheritdoc IGameAssetFacet
    function mintTo(
        address to,
        string memory tokenURI
    ) external onlyOwnerOrOperator returns (uint256) {
        return _mintTo(to, tokenURI, bytes32(0));
    }

    /// @inheritdoc IGameAssetFacet
    function mintToWithSession(
        address to,
        string memory tokenURI,
        bytes32 sessionId
    ) external onlyOwnerOrOperator returns (uint256) {
        return _mintTo(to, tokenURI, sessionId);
    }

    /// @inheritdoc IGameAssetFacet
    function updateTokenURI(
        uint256 tokenId,
        string memory newURI,
        uint256 deadline,
        bytes memory signature
    ) external onlyOwnerOrOperator {
        _updateTokenURI(tokenId, newURI, deadline, signature);
    }

    /// @inheritdoc IGameAssetFacet
    function updateTokenURIByOperator(
        uint256 tokenId,
        string memory newURI
    ) external onlyOwnerOrOperator {
        _updateTokenURIByOperator(tokenId, newURI);
    }

    /// @inheritdoc IGameAssetFacet
    function getPlayerSessionTokens(
        address player,
        bytes32 sessionId
    ) external view returns (uint256[] memory) {
        return GameAssetStorage.layout().playerSessionMints[sessionId][player];
    }

    /// @inheritdoc IGameAssetFacet
    function getTokenSession(
        uint256 tokenId
    ) external view returns (bytes32) {
        return GameAssetStorage.layout().tokenSession[tokenId];
    }

    // ============ ERC721 Standard Functions ============

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
