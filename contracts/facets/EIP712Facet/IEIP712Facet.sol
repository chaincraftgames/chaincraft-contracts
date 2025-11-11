// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IEIP712Facet
/// @dev Interface for EIP712Facet - signature verification utilities
interface IEIP712Facet {
    
    /// @notice Get the EIP-712 domain separator
    /// @return Domain separator hash
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Check if a signature has been used
    /// @param digest The signature digest to check
    /// @return True if the signature has been used
    function isSignatureUsed(bytes32 digest) external view returns (bool);
    
    /// @notice Recover signer from signature
    /// @param structHash The struct hash
    /// @param signature The signature
    /// @return signer The recovered signer address
    function recoverSigner(bytes32 structHash, bytes memory signature) external view returns (address);
}
