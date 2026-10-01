// Runs the whole workshop on Sepolia from the PRIVATE_KEY account and prints the score.
//   npx hardhat run scripts/solution/run.ts --network sepolia
import { ethers } from "hardhat";
import { solve } from "./solve";

const EVALUATOR = "0xB91F87D09a6582b25B20149C60Ad40f23F99d8Dc";

async function main() {
  const [student] = await ethers.getSigners();
  console.log(`Running as ${student.address}`);

  await solve(student, EVALUATOR);

  const evaluator = await ethers.getContractAt("Evaluator", EVALUATOR);
  const points = await ethers.getContractAt("TDERC20_PERMIT", await evaluator.TDERC20());
  console.log(`Points: ${ethers.formatEther(await points.balanceOf(student.address))} / 36`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
