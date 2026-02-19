import { createRequire } from "module";
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  sankoTestnet,
  arbitrumSepolia,
  getNetworkConfig,
} from "../utils/chains.js";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const require = createRequire(import.meta.url);

// OperableFacet ABI (same for both CCGR and CCGA)
const OPERABLE_FACET_ABI = [
  {
    type: "function",
    name: "addOperator",
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

function getDeployedAddress(
  chainId: number,
  moduleName: string = "CCGA",
): string {
  try {
    const deploymentPath = path.join(
      process.cwd(),
      "ignition",
      "deployments",
      `chain-${chainId}`,
      "deployed_addresses.json",
    );

    if (!fs.existsSync(deploymentPath)) {
      throw new Error(
        `No deployment found for chain ${chainId}. Please deploy the contract first.`,
      );
    }

    const deployedAddresses = JSON.parse(
      fs.readFileSync(deploymentPath, "utf-8"),
    );

    const contractKey = `${moduleName}#CCGADiamond`;
    const diamondAddress = deployedAddresses[contractKey];

    if (!diamondAddress) {
      // List available contracts to help the user
      const availableContracts = Object.keys(deployedAddresses)
        .filter((key) => key.includes("CCGADiamond"))
        .map((key) => `  - ${key}`)
        .join("\n");

      throw new Error(
        `Contract "${contractKey}" not found in deployment file for chain ${chainId}.\n` +
          `Available contracts:\n${availableContracts || "  (none found)"}\n` +
          `Use CONTRACT_MODULE environment variable to specify the module name (e.g., "CCGA" or "CCGADev")`,
      );
    }

    return diamondAddress;
  } catch (error) {
    console.error("❌ Error reading deployment address:", error);
    throw error;
  }
}

async function main() {
  console.log("🔧 Adding operator to CCGADiamond (Game Asset) contract...");

  // Get the operator address from environment variable (try OPERATOR_ADDR first, fallback to OPERATOR_ADDRESS)
  const operatorAddress =
    process.env.OPERATOR_ADDR || process.env.OPERATOR_ADDRESS;

  if (!operatorAddress) {
    console.error("❌ Error: Operator address is required");
    console.log(
      "Set OPERATOR_ADDR or OPERATOR_ADDRESS in your .env file, or pass as environment variable:",
    );
    console.log(
      "  OPERATOR_ADDR=0x... pnpm hardhat run scripts/add-operator-asset.ts --network <network>",
    );
    console.log(
      "Optional: CONTRACT_MODULE=CCGADev to use a different contract module",
    );
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY environment variable is required");
    console.log("Set PRIVATE_KEY in your .env file");
    process.exit(1);
  }

  // Get contract module name (defaults to "CCGA" for Game Asset)
  const contractModule = process.env.CONTRACT_MODULE || "CCGA";
  console.log(`📦 Using contract module: ${contractModule}`);

  // Get network configuration
  const { chain, chainId, rpcUrl } = getNetworkConfig(hre);

  try {
    // Get deployed contract address for the chain
    const contractAddress = getDeployedAddress(chainId, contractModule);
    console.log(`📋 Contract Address (CCGADiamond): ${contractAddress}`);
    console.log(`🔗 Chain: ${chain.name} (${chain.id})`);
    console.log(`➕ Adding Operator: ${operatorAddress}`);

    // Create account from private key
    const account = privateKeyToAccount(
      process.env.PRIVATE_KEY as `0x${string}`,
    );
    console.log(`👤 Deployer/Admin: ${account.address}`);

    // Create clients
    const publicClient = createPublicClient({
      chain: chain,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: chain,
      transport: http(rpcUrl),
    });

    // Get contract instance
    const contract = getContract({
      address: contractAddress as `0x${string}`,
      abi: OPERABLE_FACET_ABI,
      client: { public: publicClient, wallet: walletClient },
    });

    // Check if the address is already an operator
    console.log("🔍 Checking if address is already an operator...");
    const isAlreadyOperator = await contract.read.isOperator([
      operatorAddress as `0x${string}`,
    ]);
    if (isAlreadyOperator) {
      console.log("✅ Address is already an operator!");

      // Get all operators
      const operators = await contract.read.getOperators();
      console.log(`📋 Total operators: ${operators.length}`);
      console.log(`👥 Operators: ${operators.join(", ")}`);
      return;
    }

    // Add operator
    console.log("📝 Adding operator...");
    const tx = await contract.write.addOperator([
      operatorAddress as `0x${string}`,
    ]);

    console.log(`⏳ Transaction sent: ${tx}`);
    console.log("⏳ Waiting for confirmation...");

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === "success") {
      console.log("✅ Operator added successfully to CCGADiamond!");
      console.log(`📄 Transaction hash: ${tx}`);

      // Show explorer link based on chain
      if (chainId === arbitrumSepolia.id) {
        console.log(`🔗 Explorer: https://sepolia.arbiscan.io/tx/${tx}`);
      } else if (chainId === sankoTestnet.id) {
        console.log(
          `🔗 Explorer: https://sanko-arb-sepolia.calderaexplorer.xyz/tx/${tx}`,
        );
      }

      // Verify the operator was added
      const isOperator = await contract.read.isOperator([
        operatorAddress as `0x${string}`,
      ]);
      console.log(`✅ Verification: Is operator? ${isOperator}`);

      // Get all operators
      const operators = await contract.read.getOperators();
      console.log(`📋 Total operators: ${operators.length}`);
      console.log(`👥 Operators: ${operators.join(", ")}`);

      console.log("\n🎉 Operator successfully added to CCGADiamond!");
      console.log("💡 This operator can now mint tokens via the orchestrator.");
    } else {
      console.error("❌ Transaction failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error adding operator:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
