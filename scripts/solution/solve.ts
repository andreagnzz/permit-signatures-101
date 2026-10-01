// Plays every exercise of the workshop as `student`. Exercises already validated are skipped and the
// registered Solution is reused, so a run interrupted halfway can simply be restarted.
import { ethers } from "hardhat";
import type { ContractTransactionResponse } from "ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const GREETING_TYPES = {
  Greeting: [
    { name: "who", type: "address" },
    { name: "content", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const PERMIT_TRANSFER_FROM_TYPES = {
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
};

const PERMIT_SINGLE_TYPES = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
};

const AMOUNT = ethers.parseEther("1");

export async function solve(student: HardhatEthersSigner, evaluatorAddress: string) {
  const me = student.address;
  const { chainId } = await ethers.provider.getNetwork();
  const evaluator = await ethers.getContractAt("Evaluator", evaluatorAddress, student);
  const mockAddress = await evaluator.mockUnderlying();
  const mock = await ethers.getContractAt("MockUnderlying", mockAddress, student);
  const permit2Address = await evaluator.permit2();
  const permit2 = await ethers.getContractAt("IPermit2", permit2Address, student);

  const deadline = async () => BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);

  const signGreeting = async () => {
    const greeting = {
      who: me,
      content: await evaluator.getContentFor(me),
      nonce: await evaluator.evaluatorNonce(me),
      deadline: await deadline(),
    };
    const domain = { name: "Permit101Evaluator", version: "1", chainId, verifyingContract: evaluatorAddress };
    const { v, r, s } = ethers.Signature.from(await student.signTypedData(domain, GREETING_TYPES, greeting));
    return [greeting.content, greeting.nonce, greeting.deadline, v, r, s] as const;
  };

  // ERC-2612 permit granting the Evaluator `AMOUNT` on `tokenAddress`
  const signPermit = async (tokenAddress: string) => {
    const token = await ethers.getContractAt("MyPermitToken", tokenAddress);
    const permit = {
      owner: me,
      spender: evaluatorAddress,
      value: AMOUNT,
      nonce: await token.nonces(me),
      deadline: await deadline(),
    };
    const domain = { name: await token.name(), version: "1", chainId, verifyingContract: tokenAddress };
    const { v, r, s } = ethers.Signature.from(await student.signTypedData(domain, PERMIT_TYPES, permit));
    return [permit.value, permit.deadline, v, r, s] as const;
  };

  const permit2Domain = { name: "Permit2", chainId, verifyingContract: permit2Address };

  let solutionAddress = await evaluator.studentExerciseSolution(me);
  if (solutionAddress === ethers.ZeroAddress) {
    const solution = await ethers.deployContract("Solution", [evaluatorAddress], student);
    await solution.waitForDeployment();
    solutionAddress = await solution.getAddress();
    console.log(`Solution deployed at ${solutionAddress}`);
    await (await evaluator.submitExercise(solutionAddress)).wait();
    console.log("submitExercise OK");
  } else {
    console.log(`Reusing solution at ${solutionAddress}`);
  }
  const solution = await ethers.getContractAt("Solution", solutionAddress);
  const tokenAddress = await solution.getPermitToken();
  console.log(`Permit token: ${tokenAddress}, smart wallet: ${await solution.getSmartWallet()}`);

  // ex7, ex13 and ex14 each pull AMOUNT of MOCK from the student
  if ((await mock.balanceOf(me)) < 3n * AMOUNT) {
    await (await mock.getTokens(3n * AMOUNT)).wait();
  }

  const exercises: [number, string, () => Promise<ContractTransactionResponse>][] = [
    [1, "ex1_personalSign", async () =>
      evaluator.ex1_personalSign(await student.signMessage(`I want Permit101 points at address: ${me.toLowerCase()}`))],
    [2, "ex2_signTypedGreeting", async () => evaluator.ex2_signTypedGreeting(...(await signGreeting()))],
    [3, "ex3_recoverInSolution", async () => evaluator.ex3_recoverInSolution(...(await signGreeting()))],
    [4, "ex4_rejectMalleable", async () => evaluator.ex4_rejectMalleable(...(await signGreeting()))],
    [5, "ex5_rejectExpired", async () => {
      const [content, nonce, , v, r, s] = await signGreeting();
      return evaluator.ex5_rejectExpired(content, nonce, v, r, s);
    }],
    [6, "ex6_permitMock", async () => evaluator.ex6_permitMock(...(await signPermit(mockAddress)))],
    [7, "ex7_permitAndPull", async () => evaluator.ex7_permitAndPull(...(await signPermit(mockAddress)))],
    [8, "ex8_deployedPermitToken", async () => evaluator.ex8_deployedPermitToken()],
    [9, "ex9_permitOnStudentToken", async () => evaluator.ex9_permitOnStudentToken(...(await signPermit(tokenAddress)))],
    [10, "ex10_rejectExpiredOnStudentToken", async () => {
      const [value, , v, r, s] = await signPermit(tokenAddress);
      return evaluator.ex10_rejectExpiredOnStudentToken(value, v, r, s);
    }],
    [11, "ex11_rejectReplayOnStudentToken", async () =>
      evaluator.ex11_rejectReplayOnStudentToken(...(await signPermit(tokenAddress)))],
    [12, "ex12_approvePermit2", async () => {
      await (await mock.approve(permit2Address, ethers.MaxUint256)).wait();
      return evaluator.ex12_approvePermit2();
    }],
    [13, "ex13_permit2SignatureTransfer", async () => {
      // SignatureTransfer nonces are bitmap-based: any unused value works
      const transfer = {
        permitted: { token: mockAddress, amount: AMOUNT },
        spender: evaluatorAddress,
        nonce: BigInt(Date.now()),
        deadline: await deadline(),
      };
      const signature = await student.signTypedData(permit2Domain, PERMIT_TRANSFER_FROM_TYPES, transfer);
      return evaluator.ex13_permit2SignatureTransfer(AMOUNT, transfer.nonce, transfer.deadline, signature);
    }],
    [14, "ex14_permit2AllowanceTransfer", async () => {
      const [, , nonce] = await permit2.allowance(me, mockAddress, evaluatorAddress);
      const expiry = await deadline();
      const single = {
        details: { token: mockAddress, amount: AMOUNT, expiration: expiry, nonce },
        spender: evaluatorAddress,
        sigDeadline: expiry,
      };
      const signature = await student.signTypedData(permit2Domain, PERMIT_SINGLE_TYPES, single);
      return evaluator.ex14_permit2AllowanceTransfer(AMOUNT, expiry, nonce, expiry, signature);
    }],
    [15, "ex15_smartWallet1271", async () =>
      evaluator.ex15_smartWallet1271(await student.signMessage(ethers.getBytes(await evaluator.smartWalletChallenge(me))))],
  ];

  for (const [id, name, send] of exercises) {
    if (await evaluator.exerciseProgression(me, id)) {
      console.log(`${name} already validated`);
      continue;
    }
    await (await send()).wait();
    console.log(`${name} OK`);
  }
}
