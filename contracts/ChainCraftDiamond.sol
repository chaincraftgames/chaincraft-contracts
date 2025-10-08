// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@solidstate/contracts/proxy/diamond/DiamondProxy.sol";
import "@solidstate/contracts/access/ownable/safe/SafeOwnable.sol";

contract ChainCraftDiamond is DiamondProxy, SafeOwnable {
    constructor() {
        _setOwner(msg.sender);
    }
}