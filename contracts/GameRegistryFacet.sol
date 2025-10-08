// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@solidstate/contracts/token/non_fungible/SolidstateNonFungibleToken.sol';
import '@solidstate/contracts/access/ownable/safe/SafeOwnable.sol';
import '@solidstate/contracts/storage/ERC721Storage.sol';
import '@solidstate/contracts/interfaces/IERC721Metadata.sol';
import '@solidstate/contracts/token/non_fungible/metadata/NonFungibleTokenMetadata.sol';
import './GameRegistryStorage.sol';
import './IGameRegistry.sol';

/**
 * @title GameRegistryFacet
 * @dev ERC721 facet for publishing games as NFTs with unlimited supply
 * @dev Inherits from SolidstateNonFungibleToken for full ERC721 functionality
 */
contract GameRegistryFacet is SolidstateNonFungibleToken, SafeOwnable, IGameRegistry {

    // ============ Modifiers ============

    modifier onlyValidToken(uint256 tokenId) {
        require(_tokenExists(tokenId), "GameRegistry: Token does not exist");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(this.ownerOf(tokenId) == msg.sender, "GameRegistry: Not token owner");
        _;
    }

    // ============ External Functions ============

    /**
     * @dev Initialize the GameRegistry facet
     * @param _name Token name
     * @param _symbol Token symbol
     */
    function initialize(string memory _name, string memory _symbol) external override onlyOwner {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        require(ds.nextTokenId == 0, "GameRegistry: Already initialized");
        
        // Set name and symbol in ERC721Storage
        ERC721Storage.layout().name = _name;
        ERC721Storage.layout().symbol = _symbol;
        ds.nextTokenId = 1; // Start token IDs from 1
    }

    /**
     * @dev Publish a new game as an NFT
     * @param to Address to mint the game NFT to
     * @param gameURI URI containing game metadata
     * @return tokenId The ID of the newly minted game NFT
     */
    function publishGame(
        address to,
        string memory gameURI
    ) external override onlyOwner returns (uint256) {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        require(to != address(0), "GameRegistry: Mint to zero address");
        require(bytes(gameURI).length > 0, "GameRegistry: Game URI cannot be empty");

        uint256 tokenId = ds.nextTokenId;
        ds.nextTokenId++;

        _mint(to, tokenId);
        ds.gameURIs[tokenId] = gameURI;

        emit GamePublished(tokenId, to, gameURI);
        return tokenId;
    }

    /**
     * @dev Update game URI for an existing game
     * @param tokenId The game NFT token ID
     * @param newURI New URI for the game
     */
    function updateGameURI(uint256 tokenId, string memory newURI) 
        external 
        override
        onlyTokenOwner(tokenId) 
        onlyValidToken(tokenId) 
    {
        require(bytes(newURI).length > 0, "GameRegistry: URI cannot be empty");
        
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        ds.gameURIs[tokenId] = newURI;
        
        emit GameURIUpdated(tokenId, newURI);
    }

    // ============ View Functions ============

    /**
     * @dev Override tokenURI to use our custom game URIs
     * @param tokenId The token ID
     * @return The token URI
     */
    function tokenURI(uint256 tokenId) external view override(IERC721Metadata, NonFungibleTokenMetadata) returns (string memory) {
        require(_tokenExists(tokenId), "GameRegistry: URI query for nonexistent token");
        return GameRegistryStorage.layout().gameURIs[tokenId];
    }

    /**
     * @dev Get total supply of games published
     * @return The total number of games published
     */
    function totalGames() external view returns (uint256) {
        return GameRegistryStorage.layout().nextTokenId - 1;
    }

    // ============ Internal Functions ============

    /**
     * @dev Check if a token exists
     * @param tokenId The token ID to check
     * @return True if token exists
     */
    function _tokenExists(uint256 tokenId) internal view returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    // ============ Override Functions ============

    /**
     * @dev Override _handleApproveMessageValue to prevent payable approvals
     */
    function _handleApproveMessageValue(
        address operator,
        uint256 tokenId,
        uint256 value
    ) internal override {
        if (value > 0) {
            revert("GameRegistry: Payable approve not supported");
        }
        super._handleApproveMessageValue(operator, tokenId, value);
    }

    /**
     * @dev Override _handleTransferMessageValue to prevent payable transfers
     */
    function _handleTransferMessageValue(
        address from,
        address to,
        uint256 tokenId,
        uint256 value
    ) internal override {
        if (value > 0) {
            revert("GameRegistry: Payable transfer not supported");
        }
        super._handleTransferMessageValue(from, to, tokenId, value);
    }

    /**
     * @dev Override _beforeTokenTransfer for custom logic
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId);
    }
}
