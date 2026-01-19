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

const require = createRequire(import.meta.url);

// ABI for reading games from old contract
const GAME_REGISTRY_READ_ABI = [
  {
    type: "function",
    name: "totalGames",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUUIDByTokenId",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const;

// ABI for publishing games to new contract (GameMigrationFacet)
const GAME_MIGRATION_ABI = [
  {
    type: "function",
    name: "publishGameByOperator",
    inputs: [
      { name: "uuid", type: "string", internalType: "string" },
      { name: "to", type: "address", internalType: "address" },
      { name: "gameURI", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

interface GameData {
  tokenId: bigint;
  uuid: string;
  uri: string;
  owner: string;
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

async function readAllGames(
  publicClient: any,
  oldContractAddress: string
): Promise<GameData[]> {
  console.log("📖 Reading games from old contract...");

  const oldContract = getContract({
    address: oldContractAddress as `0x${string}`,
    abi: GAME_REGISTRY_READ_ABI,
    client: publicClient,
  });

  // Get total games
  const totalGames = await oldContract.read.totalGames();
  console.log(`📊 Found ${totalGames} games to migrate`);

  if (totalGames === 0n) {
    console.log("ℹ️ No games to migrate");
    return [];
  }

  const games: GameData[] = [];

  // Read games in order (token IDs start from 1)
  for (let i = 1n; i <= totalGames; i++) {
    try {
      const [uuid, uri, owner] = await Promise.all([
        oldContract.read.getUUIDByTokenId([i]),
        oldContract.read.tokenURI([i]),
        oldContract.read.ownerOf([i]),
      ]);

      games.push({
        tokenId: i,
        uuid,
        uri,
        owner,
      });

      if (i % 10n === 0n || i === totalGames) {
        console.log(`  ✓ Read ${i}/${totalGames} games...`);
      }
    } catch (error: any) {
      console.error(`❌ Error reading game ${i}:`, error.message);
      throw error;
    }
  }

  console.log(`✅ Successfully read ${games.length} games`);
  return games;
}

async function migrateGames(
  walletClient: any,
  publicClient: any,
  newContractAddress: string,
  games: GameData[]
): Promise<void> {
  console.log(`\n🚀 Migrating ${games.length} games to new contract...`);

  const newContract = getContract({
    address: newContractAddress as `0x${string}`,
    abi: GAME_MIGRATION_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  let successCount = 0;
  let failCount = 0;
  const failedGames: { tokenId: bigint; uuid: string; error: string }[] = [];

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const progress = `[${i + 1}/${games.length}]`;

    try {
      console.log(
        `${progress} Migrating game ${game.tokenId} (UUID: ${game.uuid}) to ${game.owner}...`
      );

      const tx = await newContract.write.publishGameByOperator([
        game.uuid,
        game.owner as `0x${string}`,
        game.uri,
      ]);

      console.log(`  ⏳ Transaction sent: ${tx}`);
      console.log("  ⏳ Waiting for confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      if (receipt.status === "success") {
        successCount++;
        console.log(`  ✅ Game ${game.tokenId} migrated successfully!`);
      } else {
        failCount++;
        const errorMsg = "Transaction failed";
        failedGames.push({
          tokenId: game.tokenId,
          uuid: game.uuid,
          error: errorMsg,
        });
        console.error(`  ❌ Game ${game.tokenId} migration failed`);
      }
    } catch (error: any) {
      failCount++;
      const errorMsg = error.message || "Unknown error";
      failedGames.push({
        tokenId: game.tokenId,
        uuid: game.uuid,
        error: errorMsg,
      });
      console.error(
        `  ❌ Error migrating game ${game.tokenId}: ${errorMsg}`
      );
    }

    // Small delay to avoid rate limiting
    if (i < games.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);

  if (failedGames.length > 0) {
    console.log(`\n❌ Failed Games:`);
    failedGames.forEach((game) => {
      console.log(`  - Token ID ${game.tokenId} (UUID: ${game.uuid}): ${game.error}`);
    });
  }
}

async function main() {
  console.log("🔄 Game Migration Script");
  console.log("=" .repeat(50));

  // Get old contract address
  const oldContractAddress = process.env.OLD_CONTRACT_ADDRESS;
  if (!oldContractAddress) {
    console.error("❌ Error: OLD_CONTRACT_ADDRESS environment variable is required");
    console.log(
      "Usage: export OLD_CONTRACT_ADDRESS=0x... && export NEW_CONTRACT_MODULE=CCGR && pnpm hardhat run scripts/migrate-games.ts --network <network>"
    );
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  // Get contract module name for new contract (defaults to "CCGR")
  const newContractModule = process.env.NEW_CONTRACT_MODULE || "CCGR";
  console.log(`📦 Using new contract module: ${newContractModule}`);

  // Get network configuration
  const { chain, chainId, rpcUrl } = getNetworkConfig(hre);

  try {
    // Get new contract address
    const newContractAddress = getDeployedAddress(chainId, newContractModule);
    console.log(`\n📋 Old Contract Address: ${oldContractAddress}`);
    console.log(`📋 New Contract Address: ${newContractAddress}`);
    console.log(`🔗 Chain: ${chain.name} (${chain.id})`);

    // Create account from private key
    const account = privateKeyToAccount(
      process.env.PRIVATE_KEY as `0x${string}`
    );
    console.log(`👤 Migrator: ${account.address}`);

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

    // Read all games from old contract
    const games = await readAllGames(publicClient, oldContractAddress);

    if (games.length === 0) {
      console.log("ℹ️ No games to migrate. Exiting.");
      return;
    }

    // Confirm before migrating
    console.log(`\n⚠️  About to migrate ${games.length} games:`);
    console.log(`   From: ${oldContractAddress}`);
    console.log(`   To: ${newContractAddress}`);
    console.log(`\nPress Ctrl+C to cancel, or wait 5 seconds to continue...`);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Migrate games
    await migrateGames(walletClient, publicClient, newContractAddress, games);

    console.log("\n✅ Migration complete!");
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
