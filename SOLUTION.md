# Permit and Signatures 101 — Solution

Solution for the [Permit and Signatures 101 workshop](https://github.com/Elli610/Blockchain-101/tree/main/workshops/solidity/permit-signatures-101),
deployed and validated on Ethereum Sepolia.

## Score

| Address | Points | Exercises |
| --- | --- | --- |
| [`0x526a28e84dF2cC9E7EbC0Cc5C846ACde0FA548CF`](https://sepolia.etherscan.io/address/0x526a28e84dF2cC9E7EbC0Cc5C846ACde0FA548CF) | **36 / 36** | ex0 → ex15 |

| Contract | Address |
| --- | --- |
| `Solution` (submitted) | [`0x051dD35D2fB82675Da6051590dD2614581B996F0`](https://sepolia.etherscan.io/address/0x051dD35D2fB82675Da6051590dD2614581B996F0) |
| `MyPermitToken` | [`0x1C3F4934677C7835b1B77e6915a2e591f65059aB`](https://sepolia.etherscan.io/address/0x1C3F4934677C7835b1B77e6915a2e591f65059aB) |
| `SmartWallet` | [`0xEAb9Fee6dBf6804C6C2fcB0b7DCA203150CC2Ecd`](https://sepolia.etherscan.io/address/0xEAb9Fee6dBf6804C6C2fcB0b7DCA203150CC2Ecd) |

## Contracts

[`Solution.sol`](contracts/solution/Solution.sol) deploys the permit token and the smart wallet
in its constructor, so the whole on-chain setup is one transaction.

- `recoverGreeting` checks, in order, `expired`, `malleable` (`s > n/2`), `bad v` and
  `invalid sig` (`ecrecover` returning `address(0)`). The Evaluator's domain separator is
  rebuilt from its name, version, `block.chainid` and address rather than copied, so a
  wrong field shows up as a failed recovery instead of silently matching.
- ex4 passes because the malleable twin `(55 - v, r, n - s)` hits the `s > n/2` check;
  ex5 because `deadline = 0` hits `expired`.

[`MyPermitToken.sol`](contracts/solution/MyPermitToken.sol) takes only the plain ERC-20 surface
from OpenZeppelin; `permit`, `nonces` and `DOMAIN_SEPARATOR` are written by hand.

- `DOMAIN_SEPARATOR` is computed in the constructor from `name()`, `"1"`, `block.chainid` and
  `address(this)`, which is exactly what ex8 rebuilds.
- The nonce is consumed while hashing (`nonces[owner]++` inside the struct hash). Replaying the
  same signature therefore hashes to a different digest, recovers another address and reverts:
  that is ex11.
- High-`s` signatures are rejected. The Evaluator does not grade this one, so it is covered by
  a dedicated local test.

[`SmartWallet.sol`](contracts/solution/SmartWallet.sol) accepts a hash when its owner signed it
with `personal_sign`, the format a regular wallet produces for a 32-byte message (and the one
`scripts/sign-1271.ts` uses). It relies on `ECDSA.tryRecover`, so a malformed signature returns
a non-magic value instead of reverting, as ERC-1271 expects.

## Off-chain signatures

[`scripts/solution/solve.ts`](scripts/solution/solve.ts) plays every exercise from the student
EOA. It skips exercises already validated and reuses the registered Solution, so an interrupted
run can be restarted.

- **ex2 / ex3**: both consume `evaluatorNonce`, so the Greeting is re-signed with a fresh nonce
  before each call.
- **ex6 / ex7 / ex9 / ex11**: one ERC-2612 permit per call, signed with the token's current
  `nonces(owner)`.
- **ex12**: one-time `MOCK.approve(Permit2, type(uint256).max)`.
- **ex13** (SignatureTransfer): the signed `PermitTransferFrom` includes `spender` (the
  Evaluator) even though the Solidity struct does not — Permit2 fills it with `msg.sender`.
  Nonces are bitmap-based, so any unused value works (`Date.now()`).
- **ex14** (AllowanceTransfer): the nonce is sequential per `(owner, token, spender)` and read
  from `permit2.allowance` right before signing.
- **ex15**: `signMessage(challenge bytes)`, matching the wallet's EIP-191 check.

## Local test

[`test/solution.test.ts`](test/solution.test.ts) deploys the full TD on Hardhat and runs the same
`solve` used on Sepolia, asserting 36 points. Permit2 is not deployed on a local network, so its
runtime bytecode was copied from Sepolia into [`test/permit2.bytecode`](test/permit2.bytecode) and
installed at the canonical address with `hardhat_setCode`. Permit2 recomputes its domain separator
whenever `block.chainid` differs from the cached one, so it works unchanged on chain id 31337.

## Running it

```bash
npm install
npm test                    # replays the whole workshop locally: 36 / 36
npm run solution:sepolia    # needs PRIVATE_KEY and SEPOLIA_RPC_URL in .env
```

Everything outside `contracts/solution`, `scripts/solution` and `test/solution.test.ts` comes from
the workshop repository and is kept so the local test can deploy the full TD.
