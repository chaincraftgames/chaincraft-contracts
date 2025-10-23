# ChainCraft Contracts

**EIP-2535 Diamond Proxy implementation for ChainCraft game registry NFTs**

## Overview

Diamond proxy-based smart contract system for managing game NFTs. Games are published as ERC721 tokens with unique UUIDs, allowing the game builder to mint and manage game metadata on-chain.

### Key Features

- ✅ **EIP-2535 Diamond Pattern** - Upgradeable and modular
- ✅ **ERC721 Game NFTs** - Each game is a unique NFT
- ✅ **UUID-Based Registry** - Link off-chain game IDs to on-chain tokens
- ✅ **Operator System** - Delegate game publishing to trusted addresses
- ✅ **Secure Access Control** - Diamond admin + Owner + Operators
- ✅ **EIP-7201 Storage** - No collision risk

## Architecture

```
ChainCraftDiamond (Proxy)
├── ProxyAdminFacet      - Transfer diamond admin rights
├── OperableFacet        - Manage operators
└── GameRegistryFacet    - Publish & manage game NFTs
    ├── ERC721 Standard  - Transfer, approve, etc.
    └── UUID Registry    - Map game IDs to tokens
```

### Access Control

| Role              | Can Do                                |
| ----------------- | ------------------------------------- |
| **Proxy Admin**   | diamondCut(), setFallbackAddress()    |
| **Owner**         | Initialize, add/remove operators      |
| **Operators**     | Publish games, update game URIs       |
| **Token Holders** | Transfer NFTs, approve, view metadata |

## Installation

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm hardhat compile

# Run tests
pnpm test
```

## Quick Start

### Deploy Diamond

```typescript
import { viem } from "hardhat";

// Deploy diamond (deployer becomes proxy admin + owner)
const diamond = await viem.deployContract("ChainCraftDiamond");

// Deploy facets
const proxyAdminFacet = await viem.deployContract("ProxyAdminFacet");
const operableFacet = await viem.deployContract("OperableFacet");
const gameRegistryFacet = await viem.deployContract("GameRegistryFacet");

// Add facets via diamondCut
await diamond.write.diamondCut([
  [
    { target: proxyAdminFacet.address, action: 0, selectors: [...] },
    { target: operableFacet.address, action: 0, selectors: [...] },
    { target: gameRegistryFacet.address, action: 0, selectors: [...] }
  ],
  "0x0000000000000000000000000000000000000000",
  "0x"
]);

// Initialize game registry
await diamond.write.initialize(["ChainCraft Games", "CCG"]);
```

### Publish a Game

```typescript
// Add operator (your backend wallet)
await diamond.write.addOperator([operatorAddress]);

// Publish game
await diamond.write.publishGame([
  "game-uuid-123", // UUID from your game builder
  playerAddress, // Who receives the NFT
  "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", // Game metadata URI
]);

// Update game metadata (operator only)
await diamond.write.updateGameURIByUUID([
  "game-uuid-123",
  "ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
]);
```

## Core Concepts

### Diamond Proxy Pattern

The diamond uses [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535) for upgradeability:

- **Facets** - Modular functionality (like plugins)
- **Diamond Cut** - Add/replace/remove facets
- **Storage Isolation** - Each facet has namespaced storage (EIP-7201)

### Proxy Admin vs Owner

**Two separate roles:**

```
Proxy Admin (ERC-1967)
  └─ Controls diamond structure (diamondCut)
  └─ Initially: deployer
  └─ Transfer: via ProxyAdminFacet

Owner (ERC-173)
  └─ Controls business logic (operators, etc.)
  └─ Initially: deployer
  └─ Transfer: via transferOwnership/acceptOwnership
```

**Key:** Transferring owner does NOT transfer proxy admin!

### UUID Registry

Games are identified by UUIDs from your game builder:

```typescript
// Your DB
gameId: "abc-123"

// On-chain
uuid: "abc-123" → tokenId: 1
tokenId: 1 → uuid: "abc-123"

// Lookup by UUID
const tokenId = await diamond.read.getTokenIdByUUID(["abc-123"]);

// Lookup by Token ID
const uuid = await diamond.read.getUUIDByTokenId([tokenId]);
```

## Deployment

### Testnet

```bash
# Set private key
export PRIVATE_KEY="your-private-key"

# Deploy to Sanko testnet
pnpm hardhat ignition deploy ignition/modules/ChainCraft.ts --network sankoTestnet
```

### Mainnet

Deploy from a multi-sig wallet (Gnosis Safe) for security. Both proxy admin and owner should be the multi-sig.

## Admin Transfer

If you need to transfer diamond admin rights:

```typescript
// Transfer proxy admin
await proxyAdminFacet.write.transferProxyAdmin([newAdminAddress], {
  account: currentAdminAccount,
});

// Transfer owner (separate)
await diamond.write.transferOwnership([newOwnerAddress]);
await diamond.write.acceptOwnership({ account: newOwner });
```

## Testing

```bash
# Run all tests (57 tests)
pnpm test

# Test breakdown:
# - Diamond Access Control: 14 tests
# - GameRegistry Facet: 32 tests
# - ProxyAdmin Facet: 11 tests
```

All tests passing: **57/57** ✅

See [SECURITY_NOTES.md](./SECURITY_NOTES.md) for detailed security analysis.

## Scripts

```bash
# List all operators
pnpm hardhat run scripts/list-operators.ts --network sankoTestnet

# Add an operator
pnpm hardhat run scripts/add-operator.ts --network sankoTestnet

# Remove an operator
pnpm hardhat run scripts/remove-operator.ts --network sankoTestnet
```

## Project Structure

```
contracts/
├── ChainCraftDiamond.sol           # Main diamond proxy
└── facets/
    ├── ProxyAdminFacet/            # Admin transfer
    ├── OperableFacet/              # Operator management
    └── GameRegistryFacet/          # Game NFT registry

test/
├── DiamondAccessControl.test.ts    # Diamond security tests
├── GameRegistryFacet.test.ts       # Game registry tests
└── ProxyAdminFacet.test.ts         # Admin transfer tests
```

## Resources

- **EIP-2535 Diamond Standard**: https://eips.ethereum.org/EIPS/eip-2535
- **EIP-7201 Storage Namespacing**: https://eips.ethereum.org/EIPS/eip-7201
- **SolidState Contracts**: https://github.com/solidstate-network/solidstate-solidity
- **Hardhat Documentation**: https://hardhat.org/docs

## License

MIT License - see LICENSE file for details
