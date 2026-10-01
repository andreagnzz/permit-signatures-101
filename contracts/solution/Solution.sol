// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "../IExerciseSolution.sol";
import "./MyPermitToken.sol";
import "./SmartWallet.sol";

/// @notice Solution registered on the Evaluator. Deploys the permit token and the ERC-1271 wallet
///         (owned by the deployer) so the whole setup is a single transaction.
contract Solution is IExerciseSolution {
    uint256 private constant SECP256K1_HALF_ORDER =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    bytes32 private constant GREETING_TYPEHASH =
        keccak256("Greeting(address who,string content,uint256 nonce,uint256 deadline)");

    /// @dev Evaluator's EIP-712 domain, rebuilt from its parameters rather than hard-coded.
    bytes32 public immutable EVALUATOR_DOMAIN_SEPARATOR;
    address private immutable permitToken;
    address private immutable smartWallet;

    constructor(address evaluator) {
        EVALUATOR_DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Permit101Evaluator"),
                keccak256("1"),
                block.chainid,
                evaluator
            )
        );
        permitToken = address(new MyPermitToken());
        smartWallet = address(new SmartWallet(msg.sender));
    }

    function recoverGreeting(
        address who,
        string calldata content,
        uint256 nonce,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external view returns (address signer) {
        require(deadline >= block.timestamp, "expired");
        require(uint256(s) <= SECP256K1_HALF_ORDER, "malleable");
        require(v == 27 || v == 28, "bad v");

        bytes32 structHash = keccak256(abi.encode(GREETING_TYPEHASH, who, keccak256(bytes(content)), nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", EVALUATOR_DOMAIN_SEPARATOR, structHash));

        signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "invalid sig");
    }

    function getPermitToken() external view returns (address) {
        return permitToken;
    }

    function getSmartWallet() external view returns (address) {
        return smartWallet;
    }
}
