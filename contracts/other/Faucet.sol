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
    mapping(address => bool) public operators;

    event Claimed(address indexed user, uint256 amount);
    event Deposited(address indexed depositor, uint256 amount);
    event ClaimAmountUpdated(uint256 newAmount);
    event CooldownUpdated(uint256 newCooldown);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    error ClaimTooSoon();
    error InsufficientBalance();
    error ZeroAddress();
    error AlreadyOperator();
    error NotOperator();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) {
            revert NotOperator();
        }
        _;
    }

    constructor(address _token) {
        token = _token;
        _initializeOwner(msg.sender);
    }

    /// @notice Operator can claim tokens for a recipient address
    /// @dev Only callable by operators, checks cooldown on recipient address
    /// @param recipient Address to receive the tokens
    function claim(address recipient) external onlyOperator {
        if (recipient == address(0)) revert ZeroAddress();
        
        if (block.timestamp < lastClaimTime[recipient] + claimCooldown) {
            revert ClaimTooSoon();
        }

        uint256 balance = token.balanceOf(address(this));
        if (balance < claimAmount) {
            revert InsufficientBalance();
        }

        lastClaimTime[recipient] = block.timestamp;
        token.safeTransfer(recipient, claimAmount);

        emit Claimed(recipient, claimAmount);
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

    // ============ Operator Management ============

    /// @notice Add a new operator
    /// @dev Only callable by the contract owner
    /// @param operator Address to be added as an operator
    function addOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        if (operators[operator]) revert AlreadyOperator();
        operators[operator] = true;
        emit OperatorAdded(operator);
    }

    /// @notice Remove an existing operator
    /// @dev Only callable by the contract owner
    /// @param operator Address to be removed from operators
    function removeOperator(address operator) external onlyOwner {
        if (!operators[operator]) revert NotOperator();
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }

    /// @notice Check if an address is an operator
    /// @param operator Address to check
    /// @return bool True if the address is an operator, false otherwise
    function isOperator(address operator) external view returns (bool) {
        return operators[operator];
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
