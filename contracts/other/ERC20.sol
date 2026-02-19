// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { ERC20 } from "solady/src/tokens/ERC20.sol";

contract ChainCraftToken is ERC20 {
    /// @dev The name of the token.
    function name() public pure override returns (string memory) {
        return "ChainCraft";
    }

    /// @dev The symbol of the token.
    function symbol() public pure override returns (string memory) {
        return "CC";
    }

    /// @dev The number of decimals the token uses.
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /// @dev Constructor that mints initial supply to the deployer.
    constructor(uint256 initialSupply) {
        _mint(msg.sender, initialSupply);
    }
}
