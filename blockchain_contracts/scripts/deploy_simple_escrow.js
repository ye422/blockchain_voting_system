const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying SimpleNFTEscrow with deployer:", deployer.address);

  const Escrow = await hre.ethers.getContractFactory("SimpleNFTEscrow");
  const escrow = await Escrow.deploy();
  await escrow.deployed();

  console.log("SimpleNFTEscrow deployed to:", escrow.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
