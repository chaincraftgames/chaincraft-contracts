import { createPublicClient, http, getContract } from "viem";
import { sankoTestnet, arbitrumSepolia, getNetworkConfig } from "../utils/chains.js";
import hre from "hardhat";
import fs from "fs";
import path from "path";

// TokenDuelsFacet ABI
const TOKEN_DUELS_FACET_ABI = [
  {
    type: "function",
    name: "configuredToken",
    inputs: [],
    outputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "decimals", type: "uint8", internalType: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "stakeAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

function getDeployedAddress(chainId: number, moduleName: string = "CCTD"): string {
  try {
    const deploymentPath = path.join(
      process.cwd(),
      "ignition",
      "deployments",
      `chain-${chainId}`,
      "deployed_addresses.json"
    );

    if (!fs.existsSync(deploymentPath)) {
      throw new Error(
        `No deployment found for chain ${chainId}. Please deploy the contract first.`
      );
    }

    const deployedAddresses = JSON.parse(
      fs.readFileSync(deploymentPath, "utf-8")
    );

    const contractKey = `${moduleName}#CCTDDiamond`;
    const diamondAddress = deployedAddresses[contractKey];

    if (!diamondAddress) {
      const availableContracts = Object.keys(deployedAddresses)
        .filter((key) => key.includes("CCTDDiamond"))
        .map((key) => `  - ${key}`)
        .join("\n");

      throw new Error(
        `Contract "${contractKey}" not found in deployment file for chain ${chainId}.\n` +
          `Available contracts:\n${availableContracts || "  (none found)"}\n` +
          `Use CONTRACT_MODULE environment variable to specify the module name (e.g., "CCTD" or "CCTDDev")`
      );
    }

    return diamondAddress;
  } catch (error) {
    console.error("❌ Error reading deployment address:", error);
    throw error;
  }
}

async function main() {
  console.log("🔍 Checking TokenDuelsFacet configuration...\n");

  const contractModule = process.env.CONTRACT_MODULE || "CCTD";
  const { chain, chainId, rpcUrl } = getNetworkConfig(hre);

  try {
    const contractAddress = getDeployedAddress(chainId, contractModule);
    console.log(`📋 CCTDDiamond Address: ${contractAddress}`);
    console.log(`🔗 Chain: ${chain.name} (${chain.id})\n`);

    const publicClient = createPublicClient({
      chain: chain,
      transport: http(rpcUrl),
    });

    const contract = getContract({
      address: contractAddress as `0x${string}`,
      abi: TOKEN_DUELS_FACET_ABI,
      client: { public: publicClient },
    });

    const [token, decimals] = await contract.read.configuredToken();
    const stakeAmount = await contract.read.stakeAmount();

    console.log("✅ Configuration:");
    console.log(`   Token Address: ${token}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Stake Amount: ${stakeAmount.toString()} (${stakeAmount / BigInt(10 ** decimals)} tokens)`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
