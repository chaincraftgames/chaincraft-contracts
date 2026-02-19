# ChainCraft Contracts

> EIP-2535 Diamond Proxy implementation for on-chain game registry NFTs

## Overview

Diamond proxy-based smart contract system for managing game NFTs. Each game is published as an ERC721 token with a unique UUID, enabling on-chain game metadata management with user consent via EIP-712 signatures.

### Key Features

- ✅ **EIP-2535 Diamond Pattern** - Upgradeable and modular architecture
- ✅ **ERC721 Game NFTs** - Each game is a unique, transferable NFT
- ✅ **UUID Registry** - Link off-chain game IDs to on-chain tokens
- ✅ **EIP-712 Signatures** - User consent required for game publishing
- ✅ **Operator System** - Delegate publishing rights to trusted addresses
- ✅ **EIP-7201 Storage** - Namespaced storage prevents collisions
- ✅ **Token Duels** - PvP token wagering system with EIP-712 signatures
- ✅ **Gasless Transactions** - EIP-2771 meta-transactions support
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

TokenFaucet
└── Claim tokens for testnet gameplay
```

### Access Control

| Role              | Capabilities                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| **Proxy Admin**   | `diamondCut()`, `setFallbackAddress()` - Controls diamond structure          |
| **Owner**         | Initialize facets, add/remove operators                                      |
| **Operators**     | Publish games (with user signature), update URIs (with or without signature) |
| **Token Holders** | Transfer NFTs, approve, view metadata                                        |

## Core Concepts

### Diamond Proxy Pattern

Uses [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535) for upgradeability:

- **Facets** - Modular functionality
- **Diamond Cut** - Add/replace/remove facets
- **Storage Isolation** - EIP-7201 namespaced storage

### Proxy Admin vs Owner

Two separate roles:

```
Proxy Admin (ERC-1967)
  └─ Controls diamond structure (diamondCut)
  └─ Initially: deployer
  └─ Transfer: via ProxyAdminFacet (optional)

Owner (ERC-173)
  └─ Controls business logic (operators, initialization)
  └─ Initially: deployer
  └─ Transfer: via transferOwnership/acceptOwnership
```

**Important:** Transferring owner does NOT transfer proxy admin!

### UUID Registry

Games are identified by UUIDs linking off-chain game IDs to on-chain token IDs.

## Testing

```bash
pnpm hardhat test
```

All tests passing: **62/62** ✅

## Project Structure

contracts/
├── CCGRDiamond.sol                 # Game registry diamond proxy
├── CCTDDiamond.sol                 # Token duels diamond proxy
├── other/
│   ├── ERC20.sol                   # ChainCraft Token
│   └── Faucet.sol                  # Token faucet
└── facets/
    ├── ProxyAdminFacet/            # Admin transfer (optional)
    ├── OperableFacet/              # Operator management
    ├── EIP712Facet/                # EIP-712 signature verification
    ├── GameRegistryFacet/          # Game NFT registry
    └── TokenDuelsFacet/            # PvP token wagering

test/
├── DiamondAccessControl.test.ts    # Diamond security tests
├── EIP712Facet.test.ts             # EIP-712 signature tests
├── GameRegistryFacet.test.ts       # Game registry tests
├── ProxyAdminFacet.test.ts         # Admin transfer tests
└── TokenDuelsFacet.test.ts         # Token duels tests

scripts/
├── add-operator.ts                 # Add operator
├── remove-operator.ts              # Remove operator
├── list-operators.ts               # List all operators
├── add-proxy-admin-facet.ts        # Add ProxyAdminFacet
├── remove-proxy-admin-facet.ts     # Remove ProxyAdminFacet
├── configure-token-duels.ts        # Configure duels settings
├── transfer-tokens.ts              # Transfer tokens
├── deposit-to-faucet.ts            # Deposit to faucet
└── add-operator-cctd.ts            # Add operator to CCTD
