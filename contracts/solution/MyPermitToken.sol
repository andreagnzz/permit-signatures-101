// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC-20 with a hand-written ERC-2612 `permit`. Only the plain ERC-20 surface comes from
///         OpenZeppelin; the EIP-712 domain, nonces and signature checks are implemented here.
contract MyPermitToken is ERC20 {
    uint256 private constant SECP256K1_HALF_ORDER =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    bytes32 public immutable DOMAIN_SEPARATOR;
    mapping(address => uint256) public nonces;

    constructor() ERC20("My Permit Token", "MPT") {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name())),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice Public faucet.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, "expired");
        require(uint256(s) <= SECP256K1_HALF_ORDER, "malleable");

        // Consuming the nonce while hashing makes a replayed signature hash to a different digest
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline));
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", DOMAIN_SEPARATOR, structHash));

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0) && signer == owner, "invalid signature");

        _approve(owner, spender, value);
    }
}
