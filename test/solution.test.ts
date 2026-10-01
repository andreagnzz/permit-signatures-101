// Replays the whole workshop on a local Hardhat network: deploys the TD with the real Permit2 runtime
// bytecode (copied from Sepolia) at its canonical address, then runs the same `solve` used on Sepolia.
import { expect } from "chai";
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { PERMIT_TYPES, solve } from "../scripts/solution/solve";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const SECP256K1_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

describe("Permit101 solution", () => {
  it("earns all 36 points", async () => {
    const [, student] = await ethers.getSigners();
    const permit2Code = fs.readFileSync(path.join(__dirname, "permit2.bytecode"), "utf8");
    await network.provider.send("hardhat_setCode", [PERMIT2, permit2Code]);

    const td = await ethers.deployContract("TDERC20_PERMIT", ["TD-Permit-101", "TD-PERMIT-101", 0]);
    const mock = await ethers.deployContract("MockUnderlying");
    const evaluator = await ethers.deployContract("Evaluator", [td, mock, PERMIT2]);
    await td.setTeacher(evaluator, true);

    await solve(student, await evaluator.getAddress());
    expect(await td.balanceOf(student.address)).to.equal(ethers.parseEther("36"));

    // A second run finds everything validated and must not fail
    await solve(student, await evaluator.getAddress());
  });

  // Not graded by the Evaluator, but required by the README
  it("MyPermitToken rejects the malleable twin of a valid permit", async () => {
    const [owner, spender] = await ethers.getSigners();
    const token = await ethers.deployContract("MyPermitToken");
    const { chainId } = await ethers.provider.getNetwork();
    const domain = { name: "My Permit Token", version: "1", chainId, verifyingContract: await token.getAddress() };
    const permit = { owner: owner.address, spender: spender.address, value: 1n, nonce: 0n, deadline: ethers.MaxUint256 };
    const { v, r, s } = ethers.Signature.from(await owner.signTypedData(domain, PERMIT_TYPES, permit));

    const twinS = ethers.toBeHex(SECP256K1_ORDER - BigInt(s), 32);
    await expect(token.permit(owner, spender, 1n, ethers.MaxUint256, 55 - v, r, twinS)).to.be.revertedWith("malleable");

    await token.permit(owner, spender, 1n, ethers.MaxUint256, v, r, s);
    expect(await token.allowance(owner, spender)).to.equal(1n);
  });
});
