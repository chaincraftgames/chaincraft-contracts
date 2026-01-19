import { createRequire } from "module";
import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  toFunctionSelector,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sankoTestnet, arbitrumSepolia, getNetworkConfig } from "../utils/chains.js";
import hre from "hardhat";

const require = createRequire(import.meta.url);

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

// Diamond ABI (just diamondCut function)
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

async function main() {
  console.log("🔧 Removing GameMigrationFacet from diamond...");

  // Get diamond address from environment variable
  const diamondAddress = process.env.DIAMOND_ADDRESS as `0x${string}`;

  if (!diamondAddress) {
    console.error("❌ Error: Diamond address is required");
    console.log(
      "Usage: DIAMOND_ADDRESS=0x... pnpm hardhat run scripts/remove-game-migration-facet.ts --network <network>"
    );
    process.exit(1);
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

    // Load GameMigrationFacet ABI
    const gameMigrationFacetAbi =
      require("../artifacts/contracts/facets/GameMigrationFacet/GameMigrationFacet.sol/GameMigrationFacet.json").abi;

    // Get function selectors
    const gameMigrationFacetSelectors = getFunctionSelectors(gameMigrationFacetAbi);

    console.log("\n📝 Function selectors to remove:");
    gameMigrationFacetSelectors.forEach((selector) => {
      const func = gameMigrationFacetAbi.find(
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
      address: diamondAddress,
      abi: DIAMOND_ABI,
      client: { public: publicClient, wallet: walletClient },
    });

    // Prepare diamond cut to remove facet
    const facetCut = [
      {
        target: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        action: FacetCutAction.Remove,
        selectors: gameMigrationFacetSelectors,
      },
    ];

    console.log(
      "\n⚠️  WARNING: This will permanently remove the GameMigrationFacet!"
    );
    console.log(
      "⚠️  You will no longer be able to use publishGameByOperator after this."
    );
    console.log(
      "⚠️  Press Ctrl+C to cancel or wait 5 seconds to continue...\n"
    );

    // Wait 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("⚙️  Removing GameMigrationFacet from diamond...");

    // Execute diamond cut
    const tx = await diamond.write.diamondCut([
      facetCut,
      "0x0000000000000000000000000000000000000000",
      "0x",
    ]);

    console.log(`⏳ Transaction sent: ${tx}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === "success") {
      console.log("\n✅ GameMigrationFacet successfully removed from diamond!");
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
      console.log(
        "\n✅ Migration complete! GameMigrationFacet has been removed."
      );
    } else {
      console.error("❌ Transaction failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error removing GameMigrationFacet:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
