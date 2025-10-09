// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SolidstateDiamondProxy} from "@solidstate/contracts/proxy/diamond/SolidstateDiamondProxy.sol";
import {SafeOwnable} from "@solidstate/contracts/access/ownable/safe/SafeOwnable.sol";

/// @title ChainCraft Diamond Proxy
contract ChainCraftDiamond is SolidstateDiamondProxy, SafeOwnable {
    constructor() {
        _setOwner(msg.sender);
    }
}