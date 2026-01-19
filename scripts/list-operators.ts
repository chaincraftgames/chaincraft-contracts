import { createRequire } from "module";
import { createPublicClient, http, getContract } from "viem";
import { sankoTestnet, arbitrumSepolia, getNetworkConfig } from "../utils/chains.js";
import hre from "hardhat";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);

// Combined ABI for OperableFacet and GameRegistryFacet
const DIAMOND_ABI = [
  {
    type: "function",
    name: "getOperators",
    inputs: [],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalGames",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
] as const;

function getDeployedAddress(
  chainId: number,
  moduleName: string = "CCGR"
): string {
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

    const contractKey = `${moduleName}#CCGRDiamond`;
    const diamondAddress = deployedAddresses[contractKey];

    if (!diamondAddress) {
      // List available contracts to help the user
      const availableContracts = Object.keys(deployedAddresses)
        .filter((key) => key.includes("CCGRDiamond"))
        .map((key) => `  - ${key}`)
        .join("\n");

      throw new Error(
        `Contract "${contractKey}" not found in deployment file for chain ${chainId}.\n` +
          `Available contracts:\n${availableContracts || "  (none found)"}\n` +
          `Use CONTRACT_MODULE environment variable to specify the module name (e.g., "CCGR" or "CCGRDev")`
      );
    }

    return diamondAddress;
  } catch (error) {
    console.error("❌ Error reading deployment address:", error);
    throw error;
  }
}

async function main() {
  console.log("📋 Listing operators for CCGRDiamond contract...");

  // Get contract module name (defaults to "CCGR" for backward compatibility)
  const contractModule = process.env.CONTRACT_MODULE || "CCGR";
  console.log(`📦 Using contract module: ${contractModule}`);

  // Get network configuration
  const { chain, chainId, rpcUrl } = getNetworkConfig(hre);

  try {
    // Get deployed contract address for the chain
    const contractAddress = getDeployedAddress(chainId, contractModule);
    console.log(`📋 Contract Address: ${contractAddress}`);
    console.log(`🔗 Chain: ${chain.name} (${chain.id})`);

    // Create public client
    const publicClient = createPublicClient({
      chain: chain,
      transport: http(rpcUrl),
    });

    // Get contract instance
    const contract = getContract({
      address: contractAddress as `0x${string}`,
      abi: DIAMOND_ABI,
      client: publicClient,
    });

    // Get contract info
    console.log("\n🔍 Fetching contract information...");
    const name = await contract.read.name();
    const symbol = await contract.read.symbol();
    console.log(`📛 Token Name: ${name}`);
    console.log(`🔤 Token Symbol: ${symbol}`);

    // Get contract owner
    const owner = await contract.read.owner();
    console.log(`👑 Contract Owner: ${owner}`);

    // Get all operators
    console.log("\n🔍 Fetching operators...");
    const operators = await contract.read.getOperators();

    console.log(`📊 Total operators: ${operators.length}`);

    if (operators.length === 0) {
      console.log("ℹ️ No operators found.");
    } else {
      console.log("👥 Operators:");
      operators.forEach((operator: string, index: number) => {
        console.log(`  ${index + 1}. ${operator}`);
      });
    }

    // Get total games
    const totalGames = await contract.read.totalGames();
    console.log(`\n🎮 Total Games Published: ${totalGames}`);
  } catch (error) {
    console.error("❌ Error listing operators:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
