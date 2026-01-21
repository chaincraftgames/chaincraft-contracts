// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SolidstateDiamondProxy } from "@solidstate/contracts/proxy/diamond/SolidstateDiamondProxy.sol";
import { SafeOwnable } from "@solidstate/contracts/access/ownable/safe/SafeOwnable.sol";

/// @title CCTD (ChainCraft Token Duels) Diamond Proxy
contract CCTDDiamond is SolidstateDiamondProxy, SafeOwnable {
    constructor() {
        _setOwner(msg.sender);
    }
}
