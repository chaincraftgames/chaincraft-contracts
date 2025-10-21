// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@solidstate/contracts/access/ownable/_Ownable.sol';
import '../OperableFacet/OperableInternal.sol';
import './GameRegistryInternal.sol';
import './GameRegistryStorage.sol';
import './IGameRegistryFacet.sol';

/// @title GameRegistryFacet
/// @dev Facet for publishing and managing games as NFTs with UUID tracking
/// @dev Combines ERC721 functionality with game-specific metadata and UUID registry
contract GameRegistryFacet is GameRegistryInternal, OperableInternal, _Ownable, IGameRegistryFacet {

    // ============ Errors ============
    
    error GameRegistryFacet__NotOperator();
    error GameRegistryFacet__NotTokenOwner();

    // ============ Modifiers ============

    modifier onlyOwnerOrOperator() {
        if (msg.sender != _owner() && !_isOperator(msg.sender)) 
            revert GameRegistryFacet__NotOperator();
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        if (!_isTokenOwner(tokenId)) 
            revert GameRegistryFacet__NotTokenOwner();
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
        string memory gameURI
    ) external onlyOwnerOrOperator returns (uint256) {
        return _publishGame(uuid, to, gameURI);
    }

    /// @inheritdoc IGameRegistryFacet
    function updateGameURI(uint256 tokenId, string memory newURI) 
        external
        onlyTokenOwner(tokenId)
    {
        _updateGameURI(tokenId, newURI);
    }

    /// @inheritdoc IGameRegistryFacet
    function updateGameURIByUUID(string memory uuid, string memory newURI) 
        external
    {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        uint256 tokenId = ds.uuidToTokenId[uuid];
        
        if (tokenId == 0) revert GameRegistry__GameNotFound();
        if (!_isTokenOwner(tokenId)) revert GameRegistryFacet__NotTokenOwner();
        
        _updateGameURIByUUID(uuid, newURI);
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
