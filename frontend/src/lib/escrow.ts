import { ethers } from "ethers";
import escrowAbi from "../abi/SimpleNFTEscrow.json";
import { getConfig } from "./config";

function getSigner() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("MetaMask (window.ethereum) not found");
  }
  const provider = new ethers.BrowserProvider(ethereum);
  return provider.getSigner();
}

function getEscrowContract(signerOrProvider: ethers.Provider | ethers.Signer) {
  const { SIMPLE_ESCROW_ADDRESS } = getConfig();
  return new ethers.Contract(SIMPLE_ESCROW_ADDRESS, escrowAbi.abi, signerOrProvider);
}

export async function depositToEscrow(nftAddress: string, tokenId: string | number | bigint) {
  const signer = await getSigner();
  const contract = getEscrowContract(signer);
  const tx = await contract.deposit(nftAddress, tokenId);
  const receipt = await tx.wait();

  let depositId: bigint | null = null;
  const targetAddress = String(contract.target).toLowerCase();
  for (const log of receipt.logs) {
    if (String(log.address).toLowerCase() !== targetAddress) continue;
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "Deposited") {
        depositId = parsed.args.depositId as bigint;
        break;
      }
    } catch {
      /* ignore non-escrow logs */
    }
  }

  return { tx, receipt, depositId };
}

export async function swapOnEscrow(targetDepositId: string | number | bigint, nftAddress: string, tokenId: string | number | bigint) {
  const signer = await getSigner();
  const contract = getEscrowContract(signer);
  return contract.swap(targetDepositId, nftAddress, tokenId);
}

export async function withdrawFromEscrow(depositId: string | number | bigint) {
  const signer = await getSigner();
  const contract = getEscrowContract(signer);
  return contract.withdraw(depositId);
}

export async function getDeposit(depositId: string | number | bigint) {
  const signer = await getSigner();
  const contract = getEscrowContract(signer);
  return contract.deposits(depositId);
}
