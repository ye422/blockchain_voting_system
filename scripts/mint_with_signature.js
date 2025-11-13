import { JsonRpcProvider, Wallet, Contract, ethers } from "ethers";
import CitizenSBTAbi from "../frontend/src/abi/CitizenSBT.abi.json" assert { type: "json" };

const RPC_URL = process.env.RPC_URL ?? "http://localhost:9545";
const USER_PK = process.env.USER_PK;
const CITIZEN_SBT_ADDRESS = process.env.CITIZEN_SBT_ADDRESS;

const signature = process.env.SBT_SIGNATURE;
const identityHash = process.env.SBT_IDENTITY_HASH;
const nonceUuid = process.env.SBT_NONCE;

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`${name} env is required`);
  }
  return value;
}

function uuidToBytes32(uuid) {
  const normalized = uuid.replace(/-/g, "");
  const hex = normalized.startsWith("0x") ? normalized : `0x${normalized}`;
  return ethers.zeroPadValue(hex, 32);
}

class NanosecondSafeProvider extends JsonRpcProvider {
  _wrapBlock(value, format) {
    if (value && typeof value.timestamp === "string") {
      try {
        const ts = BigInt(value.timestamp);
        // Quorum returns nanoseconds; convert to seconds so ethers doesn't overflow
        const seconds = ts / 1_000_000_000n;
        value.timestamp = `0x${seconds.toString(16)}`;
      } catch {
        // ignore conversion errors
      }
    }
    return super._wrapBlock(value, format);
  }
}

async function main() {
  assertEnv(USER_PK, "USER_PK");
  assertEnv(CITIZEN_SBT_ADDRESS, "CITIZEN_SBT_ADDRESS");
  assertEnv(signature, "SBT_SIGNATURE");
  assertEnv(identityHash, "SBT_IDENTITY_HASH");
  assertEnv(nonceUuid, "SBT_NONCE");

  const provider = new NanosecondSafeProvider(RPC_URL);
  const wallet = new Wallet(USER_PK, provider);
  const contract = new Contract(CITIZEN_SBT_ADDRESS, CitizenSBTAbi, wallet);

  const nonceBytes32 = uuidToBytes32(nonceUuid);

  console.log("Minting with signature...");
  console.log("  Wallet:", wallet.address);
  console.log("  IdentityHash:", identityHash);
  console.log("  Nonce:", nonceUuid, `(${nonceBytes32})`);

  const tx = await contract.mintWithSignature(wallet.address, identityHash, nonceBytes32, signature);
  console.log("  tx sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Mint confirmed. Block:", receipt.blockNumber);

  console.log("\nCall /api/complete-verification with:");
  console.log(`curl -X POST https://blockchain-voting-system-ye422s-projects.vercel.app/api/complete-verification \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{`);
  console.log(`    "walletAddress": "${wallet.address}",`);
  console.log(`    "txHash": "${tx.hash}"`);
  console.log(`  }'`);
}

main().catch((error) => {
  console.error("Mint failed:", error);
  process.exitCode = 1;
});
