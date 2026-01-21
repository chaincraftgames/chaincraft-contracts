// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";
import {Ownable} from "solady/src/auth/Ownable.sol";

contract TokenFaucet is Ownable {
    using SafeTransferLib for address;

    uint256 public claimAmount = 100 * 10**18;
    uint256 public claimCooldown = 4 hours;
    address public immutable token;

    mapping(address => uint256) public lastClaimTime;

    event Claimed(address indexed user, uint256 amount);
    event Deposited(address indexed depositor, uint256 amount);
    event ClaimAmountUpdated(uint256 newAmount);
    event CooldownUpdated(uint256 newCooldown);

    error ClaimTooSoon();
    error InsufficientBalance();

    constructor(address _token) {
        token = _token;
        _initializeOwner(msg.sender);
    }

    function claim() external {
        address user = msg.sender;
        
        if (block.timestamp < lastClaimTime[user] + claimCooldown) {
            revert ClaimTooSoon();
        }

        uint256 balance = token.balanceOf(address(this));
        if (balance < claimAmount) {
            revert InsufficientBalance();
        }

        lastClaimTime[user] = block.timestamp;
        token.safeTransfer(user, claimAmount);

        emit Claimed(user, claimAmount);
    }

    function deposit(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @dev Owner can update claim amount
    function setClaimAmount(uint256 newAmount) external onlyOwner {
        claimAmount = newAmount;
        emit ClaimAmountUpdated(newAmount);
    }

    /// @dev Owner can update cooldown period
    function setCooldown(uint256 newCooldown) external onlyOwner {
        claimCooldown = newCooldown;
        emit CooldownUpdated(newCooldown);
    }

    /// @dev Owner can withdraw tokens
    function withdraw(uint256 amount) external onlyOwner {
        token.safeTransfer(msg.sender, amount);
    }

    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 nextClaimTime = lastClaimTime[user] + claimCooldown;
        if (block.timestamp >= nextClaimTime) {
            return 0;
        }
        return nextClaimTime - block.timestamp;
    }

    function canClaim(address user) external view returns (bool) {
        return block.timestamp >= lastClaimTime[user] + claimCooldown;
    }

    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
