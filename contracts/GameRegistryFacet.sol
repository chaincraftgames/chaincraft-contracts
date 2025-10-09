// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@solidstate/contracts/token/non_fungible/SolidstateNonFungibleToken.sol';
import '@solidstate/contracts/access/ownable/safe/SafeOwnable.sol';
import '@solidstate/contracts/storage/ERC721Storage.sol';
import '@solidstate/contracts/interfaces/IERC721Metadata.sol';
import '@solidstate/contracts/token/non_fungible/metadata/NonFungibleTokenMetadata.sol';
import './GameRegistryStorage.sol';
import './IGameRegistry.sol';
import './Operable/Operable.sol';

/**
 * @title GameRegistryFacet
 * @dev ERC721 facet for publishing games as NFTs with unlimited supply
 * @dev Inherits from SolidstateNonFungibleToken for full ERC721 functionality
 */
contract GameRegistryFacet is SolidstateNonFungibleToken, Operable, IGameRegistry {

    // ============ Errors ============
    
    error GameRegistry__InvalidMintAddress();
    error GameRegistry__EmptyURI();
    error GameRegistry__AlreadyInitialized();
    error GameRegistry__TokenDoesNotExist();
    error GameRegistry__NotTokenOwner();
    error GameRegistry__URICannotBeEmpty();
    error GameRegistry__NotOperator();

    // ============ Modifiers ============

    modifier onlyValidToken(uint256 tokenId) {
        if (!_tokenExists(tokenId)) revert GameRegistry__TokenDoesNotExist();
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        if (this.ownerOf(tokenId) != msg.sender) revert GameRegistry__NotTokenOwner();
        _;
    }

    modifier onlyOwnerOrOperator() {
        if (msg.sender != _owner() && !_isOperator(msg.sender)) revert GameRegistry__NotOperator();
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
        if (ds.nextTokenId != 0) revert GameRegistry__AlreadyInitialized();
        
        // Set name and symbol in ERC721Storage
        ERC721Storage.layout().name = _name;
        ERC721Storage.layout().symbol = _symbol;
        ds.nextTokenId = 1; // Start token IDs from 1
        
        // Register ERC721 interface support
        _setSupportsInterface(0x80ac58cd, true); // ERC721
        _setSupportsInterface(0x5b5e139f, true); // ERC721Metadata
        _setSupportsInterface(0x780e9d63, true); // ERC721Enumerable
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
    ) external override onlyOwnerOrOperator returns (uint256) {
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        if (to == address(0)) revert GameRegistry__InvalidMintAddress();
        if (bytes(gameURI).length == 0) revert GameRegistry__EmptyURI();

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
        if (bytes(newURI).length == 0) revert GameRegistry__URICannotBeEmpty();
        
        GameRegistryStorage.Layout storage ds = GameRegistryStorage.layout();
        ds.gameURIs[tokenId] = newURI;
        
        emit GameURIUpdated(tokenId, newURI);
    }

    // ============ View Functions ============

    /**
     * @dev Override _tokenURI to use our custom game URIs
     * @param tokenId The token ID
     * @return The token URI
     */
    function _tokenURI(uint256 tokenId) internal view override returns (string memory) {
        if (!_tokenExists(tokenId)) revert GameRegistry__TokenDoesNotExist();
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
}
