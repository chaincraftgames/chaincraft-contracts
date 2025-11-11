// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EIP712Internal } from './EIP712Internal.sol';
import { IEIP712Facet } from './IEIP712Facet.sol';

/// @title EIP712Facet
/// @dev Facet for EIP-712 signature verification utilities
contract EIP712Facet is EIP712Internal, IEIP712Facet {

    /// @inheritdoc IEIP712Facet
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _getDomainSeparator();
    }

    /// @inheritdoc IEIP712Facet
    function isSignatureUsed(bytes32 digest) external view returns (bool) {
        return _isSignatureUsed(digest);
    }
    
    /// @inheritdoc IEIP712Facet
    function recoverSigner(bytes32 structHash, bytes memory signature) external view returns (address) {
        return _recoverSigner(structHash, signature);
    }
}
