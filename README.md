# ChainCraft Contracts

> Smart contracts powering the ChainCraft platform

## Overview

Smart contract system with three diamonds:
- **CCGR** - Game registry for publishing games as ERC721 NFTs with UUID linking
- **CCTD** - Token duels for PvP wagering
- **CCGA** - Game assets for minting NFTs with unique URIs

### Key Features

- ✅ **EIP-2535 Diamond Pattern** - Upgradeable and modular architecture
- ✅ **ERC721 NFTs** - Games and assets as unique, transferable tokens
- ✅ **UUID Registry** - Link off-chain game IDs to on-chain tokens
- ✅ **EIP-712 Signatures** - User consent required for publishing and wagering
- ✅ **Operator System** - Delegate actions to trusted addresses
- ✅ **EIP-7201 Storage** - Namespaced storage prevents collisions
- ✅ **Token Duels** - PvP wagering with EIP-712 signatures
- ✅ **Game Assets** - Mint NFTs with unique URIs
- ✅ **Faucet System** - Token faucet for testnet gameplay

## Deployments

### Arbitrum Sepolia (Chain ID: 421614)

- **CCGR Diamond:** `0x56d1349D9903498450f63182dDa7b8D7D360f06F`
- **Explorer:** https://sepolia.arbiscan.io/address/0x56d1349D9903498450f63182dDa7b8D7D360f06F

### Token Duels (Chain ID: 421614)

- **CCTD Diamond:** `0xFF4bb838a0f65F49BB576A347A0E7feEA7Fe035c`
- **Faucet:** `0x3673fd27425cC1292870F6E90CbC3CB3cfb4009b`
- **ChainCraftToken (ERC20):** `0xe3D55A787EF42b30c5877Bff8f513e60e95D2F7D`
- **Explorer:** https://sepolia.arbiscan.io/address/0xFF4bb838a0f65F49BB576A347A0E7feEA7Fe035c

### Game Assets (Chain ID: 421614)

- **CCGA Diamond:** `0x1DA0Cfb097Dd5b4388317f0Fe99d5A60C6385f12`
- **Explorer:** https://sepolia.arbiscan.io/address/0x1DA0Cfb097Dd5b4388317f0Fe99d5A60C6385f12

## Installation

```bash
pnpm install
```

## Quick Start

```bash
# Compile contracts
pnpm hardhat compile

# Run tests
pnpm hardhat test

# Deploy
pnpm hardhat ignition deploy ignition/modules/ChainCraft.ts --network <your-network>
```

## Architecture

```
CCGRDiamond (EIP-2535 Proxy)
├── OperableFacet        - Manage operators
├── EIP712Facet          - EIP-712 signature verification
└── GameRegistryFacet    - Publish & manage game NFTs
    ├── ERC721 Standard
    ├── UUID Registry
    └── EIP-712 Auth

CCTDDiamond (EIP-2535 Proxy - Token Duels)
├── OperableFacet        - Manage operators
└── TokenDuelsFacet      - PvP token wagering
    ├── Create Sessions
    ├── Join Sessions
    ├── Resolve Duels
    └── EIP-712 Signatures

CCGADiamond (EIP-2535 Proxy - Game Assets)
├── OperableFacet        - Manage operators
├── EIP712Facet          - EIP-712 signature verification
└── GameAssetFacet       - Mint & manage game asset NFTs
    ├── ERC721 Standard
    ├── Unique URIs
    └── EIP-712 Auth

TokenFaucet
└── Claim tokens for testnet gameplay
```

## Testing

```bash
pnpm hardhat test
```

All tests passing: **62/62** ✅
