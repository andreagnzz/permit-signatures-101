// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../IERC1271.sol";

/// @notice ERC-1271 wallet: a hash is approved when `owner` signed it with `personal_sign`
///         (EIP-191 prefix), which is what a regular wallet produces for a 32-byte message.
contract SmartWallet is IERC1271 {
    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        (address signer, ECDSA.RecoverError err, ) =
            ECDSA.tryRecover(MessageHashUtils.toEthSignedMessageHash(hash), signature);
        return err == ECDSA.RecoverError.NoError && signer == owner
            ? IERC1271.isValidSignature.selector
            : bytes4(0xffffffff);
    }
}
