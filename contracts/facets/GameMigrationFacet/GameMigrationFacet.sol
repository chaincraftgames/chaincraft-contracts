// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { _Ownable } from '@solidstate/contracts/access/ownable/_Ownable.sol';
import { OperableInternal } from '../OperableFacet/OperableInternal.sol';
import { GameMigrationInternal } from './GameMigrationInternal.sol';
import { IGameMigrationFacet } from './IGameMigrationFacet.sol';

/// @title GameMigrationFacet
/// @dev Facet for operator-only game publishing (for migrations)
/// @dev This facet can be added/removed via diamond cut as needed
contract GameMigrationFacet is GameMigrationInternal, OperableInternal, _Ownable, IGameMigrationFacet {

    // ============ Errors ============
    
    error GameMigrationFacet__NotOperator();

    // ============ Modifiers ============

    modifier onlyOwnerOrOperator() {
        if (msg.sender != _owner() && !_isOperator(msg.sender)) 
            revert GameMigrationFacet__NotOperator();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IGameMigrationFacet
    function publishGameByOperator(
        string memory uuid,
        address to,
        string memory gameURI
    ) external override onlyOwnerOrOperator returns (uint256) {
        return _publishGameByOperator(uuid, to, gameURI);
    }
}
