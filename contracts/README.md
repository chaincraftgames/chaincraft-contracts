# ChainCraft Contracts

## Overview

This project implements a game registry system using ERC721 NFTs with a diamond proxy pattern for publishing games as NFTs.

## Architecture

### Diamond Proxy Pattern

- **ChainCraftDiamond.sol**: Main diamond proxy contract
- **GameRegistryFacet.sol**: ERC721 facet for game publishing functionality

### File Structure

#### Core Contracts

- `ChainCraftDiamond.sol` - Main diamond proxy contract
- `GameRegistryFacet.sol` - ERC721 facet for game publishing
- `GameRegistryStorage.sol` - Storage layout for game-specific data
- `IGameRegistry.sol` - Interface for game registry functionality

#### Key Features

**GameRegistryFacet.sol**

- Inherits from `SolidstateNonFungibleToken` for full ERC721 functionality
- Inherits from `SafeOwnable` for access control
- Implements `IGameRegistry` interface
- Uses proper SolidState storage patterns

**GameRegistryStorage.sol**

- Uses ERC7201 storage layout pattern
- Stores game-specific data (metadata, URIs, token counter)
- Compatible with SolidState diamond storage

**IGameRegistry.sol**

- Defines interface for game publishing functionality
- Includes events and function signatures

## Usage

### Initialization

1. Deploy `ChainCraftDiamond`
2. Add `GameRegistryFacet` to the diamond
3. Call `initialize(name, symbol)` on the facet

### Publishing Games

```solidity
// Publish a new game
uint256 tokenId = gameRegistry.publishGame(
    publisher,
    "https://example.com/game-metadata.json",
    "Game description"
);

// Update game metadata
gameRegistry.updateGameMetadata(tokenId, "Updated description");

// Get game information
string memory metadata = gameRegistry.getGameMetadata(tokenId);
string memory uri = gameRegistry.getGameURI(tokenId);
```

### ERC721 Functions

All standard ERC721 functions are available:

- `transferFrom()`, `safeTransferFrom()`
- `approve()`, `setApprovalForAll()`
- `balanceOf()`, `ownerOf()`
- `tokenURI()`

## Benefits

1. **Modular Architecture**: Uses diamond proxy pattern for upgradeability
2. **SolidState Integration**: Leverages battle-tested SolidState contracts
3. **Proper Storage**: Uses ERC7201 storage layout for safety
4. **Full ERC721 Compliance**: Complete ERC721 functionality with metadata
5. **Game-Specific Features**: Custom functions for game publishing and management
6. **Unlimited Supply**: No supply cap for game NFTs

## Storage Layout

The contract uses two storage layouts:

- **ERC721Storage**: Standard ERC721 state (owners, approvals, etc.)
- **GameRegistryStorage**: Game-specific data (metadata, URIs, counter)

This separation ensures compatibility with other ERC721 facets while maintaining game-specific functionality.
