import { createRequire } from "module";
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sankoTestnet } from "../utils/chains.js";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);

// OperableFacet ABI
const OPERABLE_FACET_ABI = [
  {
    type: "function",
    name: "removeOperator",
    inputs: [{ name: "operator", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isOperator",
    inputs: [{ name: "operator", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOperators",
    inputs: [],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
] as const;

function getDeployedAddress(chainId: number): string {
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

    const diamondAddress = deployedAddresses["ChainCraft#ChainCraftDiamond"];

    if (!diamondAddress) {
      throw new Error(
        `ChainCraftDiamond address not found in deployment file for chain ${chainId}`
      );
    }

    return diamondAddress;
  } catch (error) {
    console.error("❌ Error reading deployment address:", error);
    throw error;
  }
}

async function main() {
  console.log("🔧 Removing operator from ChainCraftDiamond contract...");

  // Get the operator address from environment variable
  const operatorAddress = process.env.OPERATOR_ADDR;

  if (!operatorAddress) {
    console.error("❌ Error: Operator address is required");
    console.log(
      "Usage: export OPERATOR_ADDR=0x... && pnpm hardhat run scripts/remove-operator.ts --network sankoTestnet"
    );
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  try {
    // Get deployed contract address for the chain
    const contractAddress = getDeployedAddress(sankoTestnet.id);
    console.log(`📋 Contract Address: ${contractAddress}`);
    console.log(`🔗 Chain: ${sankoTestnet.name} (${sankoTestnet.id})`);
    console.log(`➖ Removing Operator: ${operatorAddress}`);

    // Create account from private key
    const account = privateKeyToAccount(
      process.env.PRIVATE_KEY as `0x${string}`
    );
    console.log(`👤 Deployer: ${account.address}`);

    // Create clients
    const publicClient = createPublicClient({
      chain: sankoTestnet,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: sankoTestnet,
      transport: http(),
    });

    // Get contract instance
    const contract = getContract({
      address: contractAddress as `0x${string}`,
      abi: OPERABLE_FACET_ABI,
      client: { public: publicClient, wallet: walletClient },
    });

    // Check if the address is an operator
    console.log("🔍 Checking if address is an operator...");
    const isOperator = await contract.read.isOperator([
      operatorAddress as `0x${string}`,
    ]);

    if (!isOperator) {
      console.log("ℹ️ Address is not an operator!");
      return;
    }

    // Remove operator
    console.log("📝 Removing operator...");
    const tx = await contract.write.removeOperator([
      operatorAddress as `0x${string}`,
    ]);

    console.log(`⏳ Transaction sent: ${tx}`);
    console.log("⏳ Waiting for confirmation...");

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === "success") {
      console.log("✅ Operator removed successfully!");
      console.log(`📄 Transaction hash: ${tx}`);
      console.log(
        `🔗 Explorer: https://sanko-arb-sepolia.calderaexplorer.xyz/tx/${tx}`
      );

      // Verify the operator was removed
      const isStillOperator = await contract.read.isOperator([
        operatorAddress as `0x${string}`,
      ]);
      console.log(`✅ Verification: Is operator? ${isStillOperator}`);

      // Get all operators
      const operators = await contract.read.getOperators();
      console.log(`📋 Total operators: ${operators.length}`);
      console.log(`👥 Operators: ${operators.join(", ")}`);
    } else {
      console.error("❌ Transaction failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error removing operator:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
