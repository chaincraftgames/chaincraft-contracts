import { createRequire } from "module";
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  toFunctionSelector,
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

const require = createRequire(import.meta.url);

// Diamond ABI for diamondCut
const DIAMOND_ABI = [
  {
    type: "function",
    name: "diamondCut",
    inputs: [
      {
        name: "facetCuts",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "action", type: "uint8" },
          { name: "selectors", type: "bytes4[]" },
        ],
      },
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

enum FacetCutAction {
  Add = 0,
  Replace = 1,
  Remove = 2,
}

// Helper function to extract function selectors from ABI
function getFunctionSelectors(abi: any[]): `0x${string}`[] {
  return abi
    .filter((item) => item.type === "function")
    .map((func) => {
      const signature = `${func.name}(${func.inputs
        .map((input: any) => input.type)
        .join(",")})`;
      return toFunctionSelector(signature);
    });
}

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
      const availableContracts = Object.keys(deployedAddresses)
        .filter((key) => key.includes("CCGRDiamond"))
        .map((key) => `  - ${key}`)
        .join("\n");

      throw new Error(
        `Contract "${contractKey}" not found in deployment file for chain ${chainId}.\n` +
          `Available contracts:\n${availableContracts || "  (none found)"}\n` +
          `Use CONTRACT_MODULE environment variable to specify the module name`
      );
    }

    return diamondAddress;
  } catch (error) {
    console.error("❌ Error reading deployment address:", error);
    throw error;
  }
}

async function main() {
  console.log("🔧 Adding GameMigrationFacet to CCGRDiamond contract...");

  // Get diamond address from environment variable or deployment file
  let diamondAddress = process.env.DIAMOND_ADDRESS as `0x${string}` | undefined;

  if (!diamondAddress) {
    // Try to get from deployment file
    const contractModule = process.env.CONTRACT_MODULE || "CCGR";
    const { chainId } = getNetworkConfig(hre);
    try {
      diamondAddress = getDeployedAddress(chainId, contractModule) as `0x${string}`;
      console.log(`📦 Using contract module: ${contractModule}`);
    } catch (error) {
      console.error("❌ Error: Diamond address is required");
      console.log(
        "Usage: DIAMOND_ADDRESS=0x... pnpm hardhat run scripts/add-game-migration-facet.ts --network <network>"
      );
      console.log(
        "   OR: export CONTRACT_MODULE=CCGR && pnpm hardhat run scripts/add-game-migration-facet.ts --network <network>"
      );
      process.exit(1);
    }
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  // Get network configuration
  const { chain, chainId, rpcUrl } = getNetworkConfig(hre);

  try {
    console.log(`📋 Diamond Address: ${diamondAddress}`);
    console.log(`🔗 Chain: ${chain.name} (${chain.id})`);

    // Create account from private key
    const account = privateKeyToAccount(
      process.env.PRIVATE_KEY as `0x${string}`
    );
    console.log(`👤 Deployer: ${account.address}`);

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

    // Load GameMigrationFacet ABI and bytecode
    const facetArtifact = require("../artifacts/contracts/facets/GameMigrationFacet/GameMigrationFacet.sol/GameMigrationFacet.json");
    const facetAbi = facetArtifact.abi;
    const facetBytecode = facetArtifact.bytecode;

    // Deploy GameMigrationFacet
    console.log("\n📦 Deploying GameMigrationFacet...");
    const deployHash = await walletClient.deployContract({
      abi: facetAbi,
      bytecode: facetBytecode,
      args: [],
    });

    console.log(`⏳ Deployment transaction: ${deployHash}`);
    console.log("⏳ Waiting for confirmation...");

    const deployReceipt = await publicClient.waitForTransactionReceipt({
      hash: deployHash,
    });

    if (!deployReceipt.contractAddress) {
      throw new Error("Failed to get deployed contract address");
    }

    const facetAddress = deployReceipt.contractAddress;
    console.log(`✅ GameMigrationFacet deployed at: ${facetAddress}`);

    // Get function selectors
    const facetSelectors = getFunctionSelectors(facetAbi);

    console.log("\n📝 Function selectors to add:");
    facetSelectors.forEach((selector) => {
      const func = facetAbi.find(
        (item: any) =>
          item.type === "function" &&
          toFunctionSelector(
            `${item.name}(${item.inputs.map((i: any) => i.type).join(",")})`
          ) === selector
      );
      console.log(`  - ${func?.name || selector}`);
    });

    // Get diamond contract
    const diamond = getContract({
      address: diamondAddress as `0x${string}`,
      abi: DIAMOND_ABI,
      client: { public: publicClient, wallet: walletClient },
    });

    // Prepare diamond cut
    const facetCut = [
      {
        target: facetAddress,
        action: FacetCutAction.Add,
        selectors: facetSelectors,
      },
    ];

    // Perform diamond cut
    console.log("\n🔪 Performing diamond cut...");
    const tx = await diamond.write.diamondCut([
      facetCut,
      "0x0000000000000000000000000000000000000000",
      "0x",
    ]);

    console.log(`⏳ Transaction sent: ${tx}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === "success") {
      console.log("✅ GameMigrationFacet added successfully!");
      console.log(`📄 Transaction hash: ${tx}`);

      // Show explorer link based on chain
      if (chainId === arbitrumSepolia.id) {
        console.log(
          `🔗 Explorer: https://sepolia.arbiscan.io/tx/${tx}`
        );
      } else if (chainId === sankoTestnet.id) {
        console.log(
          `🔗 Explorer: https://sanko-arb-sepolia.calderaexplorer.xyz/tx/${tx}`
        );
      }
      console.log("\nYou can now use:");
      console.log(`  - publishGameByOperator(string uuid, address to, string gameURI)`);
    } else {
      console.error("❌ Transaction failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error adding GameMigrationFacet:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
