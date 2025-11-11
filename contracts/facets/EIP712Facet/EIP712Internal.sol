// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EIP712 } from '@solidstate/contracts/cryptography/EIP712.sol';
import { ECDSA } from '@solidstate/contracts/cryptography/ECDSA.sol';
import { EIP712Storage } from './EIP712Storage.sol';

/// @title EIP712Internal
/// @dev Internal EIP-712 signature verification logic
abstract contract EIP712Internal {
    
    // ============ Errors ============
    
    error EIP712__SignatureExpired();
    error EIP712__SignatureAlreadyUsed();
    error EIP712__InvalidSigner();

    // ============ Events ============
    
    /// @notice Emitted when a signature is verified and used
    event SignatureUsed(
        bytes32 indexed digest,
        address indexed signer
    );

    // ============ EIP-712 Domain ============

    /// @notice Returns the EIP-712 domain name
    function _domainName() internal pure virtual returns (string memory) {
        return "ChainCraft";
    }

    /// @notice Returns the EIP-712 domain version
    function _domainVersion() internal pure virtual returns (string memory) {
        return "1";
    }

    /// @notice Calculate the EIP-712 domain separator
    /// @dev Uses name, version, chainId, and verifyingContract
    /// @return The domain separator
    function _domainSeparator() internal view returns (bytes32) {
        bytes32 nameHash = keccak256(bytes(_domainName()));
        bytes32 versionHash = keccak256(bytes(_domainVersion()));
        
        return EIP712.calculateDomainSeparator_01111(
            nameHash,
            versionHash
        );
    }

    /// @notice Hash typed data according to EIP-712
    /// @param structHash The struct hash
    /// @return The EIP-712 typed data hash
    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return ECDSA.toEIP712RecoverableHash(_domainSeparator(), structHash);
    }

    // ============ Internal Functions ============

    /// @notice Verify an EIP-712 signature and return the signer
    /// @param structHash The hash of the typed data struct
    /// @param deadline Signature expiration timestamp
    /// @param signature EIP-712 signature
    /// @return signer The recovered signer address
    function _verifySignatureAndRecover(
        bytes32 structHash,
        uint256 deadline,
        bytes memory signature
    ) internal returns (address signer) {
        EIP712Storage.Layout storage ds = EIP712Storage.layout();
        
        // Check deadline
        if (block.timestamp > deadline) {
            revert EIP712__SignatureExpired();
        }

        // Get EIP-712 digest
        bytes32 digest = _hashTypedData(structHash);

        // Check if signature was already used (prevent replay)
        if (ds.usedSignatures[digest]) {
            revert EIP712__SignatureAlreadyUsed();
        }

        // Recover signer from signature
        signer = ECDSA.recover(digest, signature);
        
        // Ensure signer is not zero address
        if (signer == address(0)) {
            revert EIP712__InvalidSigner();
        }

        // Mark signature as used
        ds.usedSignatures[digest] = true;

        emit SignatureUsed(digest, signer);
    }

    /// @notice Check if a signature digest has been used
    /// @param digest The signature digest
    /// @return True if the signature has been used
    function _isSignatureUsed(bytes32 digest) internal view returns (bool) {
        return EIP712Storage.layout().usedSignatures[digest];
    }

    /// @notice Get the domain separator
    /// @return The EIP-712 domain separator
    function _getDomainSeparator() internal view returns (bytes32) {
        return _domainSeparator();
    }
    
    /// @notice Recover signer from struct hash and signature
    /// @param structHash The struct hash
    /// @param signature The signature
    /// @return signer The recovered signer address
    function _recoverSigner(bytes32 structHash, bytes memory signature) internal view returns (address) {
        bytes32 digest = _hashTypedData(structHash);
        return ECDSA.recover(digest, signature);
    }
}
