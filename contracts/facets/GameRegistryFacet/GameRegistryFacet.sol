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
    function initialize(string memory name, string memory symbol) external onlyOwner {
        _initialize(name, symbol);
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
    function updateGameURI(uint256 tokenId, string memory newURI) 
        external
        onlyOwnerOrOperator
    {
        _updateGameURI(tokenId, newURI);
    }

    /// @inheritdoc IGameRegistryFacet
    function updateGameURIByUUID(string memory uuid, string memory newURI) 
        external
        onlyOwnerOrOperator
    {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        uint256 tokenId = ds.uuidToTokenId[uuid];
        
        if (tokenId == 0) revert GameRegistry__GameNotFound();
        
        _updateGameURI(tokenId, newURI);
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
}
