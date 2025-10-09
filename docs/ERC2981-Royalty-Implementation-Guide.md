# ERC-2981 Royalty Implementation Guide

## Overview

This guide explains how to implement ERC-2981 (NFT Royalty Standard) in your GameRegistry contract. ERC-2981 allows NFT creators to receive royalties automatically when their NFTs are sold on marketplaces like OpenSea, LooksRare, and others.

## What is ERC-2981?

ERC-2981 is a standard that defines how NFT contracts should communicate royalty information to marketplaces. When an NFT is sold, the marketplace calls the `royaltyInfo()` function to determine:

- Who should receive the royalty
- How much royalty to pay (in basis points)

## Implementation Steps

### 1. Add Required Imports

```solidity
import '@solidstate/contracts/token/common/royalty/NFTRoyalty.sol';
```

### 2. Update Contract Inheritance

```solidity
contract GameRegistryFacet is SolidstateNonFungibleToken, SafeOwnable, NFTRoyalty, IGameRegistry {
    // ... existing code ...
}
```

### 3. Add Royalty Storage

In `GameRegistryStorage.sol`, add royalty fields to the Layout struct:

```solidity
struct Layout {
    // ... existing fields ...

    // Royalty information
    uint16 defaultRoyaltyBPS;  // Default royalty in basis points (e.g., 250 = 2.5%)
    address defaultRoyaltyReceiver;  // Default royalty receiver
}
```

### 4. Add Royalty Functions

Add these functions to your GameRegistryFacet:

```solidity
// ============ Royalty Functions ============

/**
 * @dev Set default royalty for all games
 * @param receiver Address to receive royalties
 * @param royaltyBPS Royalty in basis points (e.g., 250 = 2.5%)
 */
function setDefaultRoyalty(address receiver, uint16 royaltyBPS) external onlyOwner {
    require(receiver != address(0), "GameRegistry: Invalid receiver");
    require(royaltyBPS <= 1000, "GameRegistry: Royalty too high"); // Max 10%

    GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
    ds.defaultRoyaltyReceiver = receiver;
    ds.defaultRoyaltyBPS = royaltyBPS;

    emit DefaultRoyaltyUpdated(receiver, royaltyBPS);
}

/**
 * @dev Get default royalty information
 * @return receiver Address to receive royalties
 * @return royaltyBPS Royalty in basis points
 */
function getDefaultRoyalty() external view returns (address receiver, uint16 royaltyBPS) {
    GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
    return (ds.defaultRoyaltyReceiver, ds.defaultRoyaltyBPS);
}
```

### 5. Override \_royaltyInfo Function

```solidity
/**
 * @dev Override _royaltyInfo to use our custom royalty logic
 * @param tokenId The token ID
 * @param salePrice The sale price
 * @return receiver The royalty receiver
 * @return royaltyAmount The royalty amount
 */
function _royaltyInfo(uint256 tokenId, uint256 salePrice) internal view override returns (address receiver, uint256 royaltyAmount) {
    GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();

    if (ds.defaultRoyaltyReceiver != address(0)) {
        receiver = ds.defaultRoyaltyReceiver;
        royaltyAmount = (salePrice * ds.defaultRoyaltyBPS) / 10000;
    } else {
        // No royalty set
        receiver = address(0);
        royaltyAmount = 0;
    }
}
```

### 6. Add Events

In your interface, add the royalty event:

```solidity
interface IGameRegistry {
    // ... existing events ...
    event DefaultRoyaltyUpdated(address indexed receiver, uint16 royaltyBPS);

    // ... existing functions ...
    function setDefaultRoyalty(address receiver, uint16 royaltyBPS) external;
    function getDefaultRoyalty() external view returns (address receiver, uint16 royaltyBPS);
}
```

## Usage Examples

### Setting Default Royalty

```solidity
// Set 2.5% default royalty for all games
gameRegistry.setDefaultRoyalty(owner, 250); // 250 = 2.5%
```

### Getting Royalty Information

```solidity
// Get default royalty info
(address receiver, uint16 royaltyBPS) = gameRegistry.getDefaultRoyalty();
```

### Marketplace Integration

Marketplaces will automatically call `royaltyInfo(tokenId, salePrice)` to get royalty information:

```solidity
// Example: $1000 sale with 2.5% royalty
(address receiver, uint256 royaltyAmount) = gameRegistry.royaltyInfo(tokenId, 1000);
// receiver = owner address
// royaltyAmount = 25 (2.5% of $1000)
```

## Basis Points Explanation

Royalties are specified in basis points (BPS):

- 1 basis point = 0.01%
- 100 basis points = 1%
- 250 basis points = 2.5%
- 1000 basis points = 10%

## Marketplace Support

ERC-2981 is supported by:

- ✅ OpenSea
- ✅ LooksRare
- ✅ X2Y2
- ✅ Rarible
- ✅ Foundation
- ✅ SuperRare
- ✅ And many others

## Security Considerations

1. **Maximum Royalty**: Limit royalties to reasonable amounts (e.g., max 10%)
2. **Access Control**: Only owner should be able to set default royalty
3. **Validation**: Always validate receiver addresses and royalty amounts
4. **Events**: Emit events for transparency

## Testing

Test your royalty implementation:

```solidity
function testRoyalty() public {
    // Set royalty
    gameRegistry.setDefaultRoyalty(owner, 250);

    // Test royalty calculation
    (address receiver, uint256 amount) = gameRegistry.royaltyInfo(1, 1000);
    assertEq(receiver, owner);
    assertEq(amount, 25); // 2.5% of 1000
}
```

## Advanced Features (Optional)

### Per-Game Royalties

If you want different royalties for different games, you can extend the storage:

```solidity
struct Layout {
    // ... existing fields ...
    mapping(uint256 => uint16) gameRoyaltyBPS;  // Per-game royalty rates
    mapping(uint256 => address) gameRoyaltyReceivers;  // Per-game royalty receivers
}
```

### Royalty Management Functions

```solidity
function setGameRoyalty(uint256 tokenId, address receiver, uint16 royaltyBPS) external onlyTokenOwner(tokenId) {
    // Implementation for per-game royalties
}
```

## Benefits

1. **Automatic Payments**: Marketplaces automatically pay royalties
2. **Standard Compliance**: Works with all ERC-2981 compatible marketplaces
3. **Transparent**: Royalty information is publicly available
4. **Flexible**: Can set different rates for different games
5. **Gas Efficient**: Minimal gas cost for royalty queries

## Conclusion

Implementing ERC-2981 royalties ensures that game creators are automatically compensated when their games are sold on any compatible marketplace. This creates a sustainable revenue model for game developers and encourages the creation of high-quality games.

The implementation is straightforward and follows the standard pattern used by most NFT projects. Once implemented, your GameRegistry will be fully compatible with all major NFT marketplaces.
