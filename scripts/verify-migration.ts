import { createRequire } from "module";
import {
  createPublicClient,
  http,
  getContract,
} from "viem";
import {
  sankoTestnet,
  arbitrumSepolia,
  getNetworkConfig,
} from "../utils/chains.js";
import hre from "hardhat";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);

// ABI for reading games from contracts
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
  {
    type: "function",
    name: "getTokenIdByUUID",
    inputs: [{ name: "uuid", type: "string", internalType: "string" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

interface GameData {
  tokenId: bigint;
  uuid: string;
  uri: string;
  owner: string;
}

interface VerificationResult {
  uuid: string;
  oldTokenId: bigint;
  newTokenId: bigint;
  uriMatch: boolean;
  ownerMatch: boolean;
  oldUri: string;
  newUri: string;
  oldOwner: string;
  newOwner: string;
  status: "✅" | "❌";
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
          `Use NEW_CONTRACT_MODULE environment variable to specify the module name (e.g., "CCGR" or "CCGRDev")`
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
  contractAddress: string,
  contractName: string
): Promise<GameData[]> {
  console.log(`📖 Reading games from ${contractName}...`);

  const contract = getContract({
    address: contractAddress as `0x${string}`,
    abi: GAME_REGISTRY_READ_ABI,
    client: publicClient,
  });

  // Get total games
  const totalGames = await contract.read.totalGames();
  console.log(`📊 Found ${totalGames} games`);

  if (totalGames === 0n) {
    console.log("ℹ️ No games found");
    return [];
  }

  const games: GameData[] = [];

  // Read games in order (token IDs start from 1)
  for (let i = 1n; i <= totalGames; i++) {
    try {
      const [uuid, uri, owner] = await Promise.all([
        contract.read.getUUIDByTokenId([i]),
        contract.read.tokenURI([i]),
        contract.read.ownerOf([i]),
      ]);

      games.push({
        tokenId: i,
        uuid,
        uri,
        owner: owner.toLowerCase(),
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

async function verifyMigration(
  publicClient: any,
  oldContractAddress: string,
  newContractAddress: string
): Promise<VerificationResult[]> {
  console.log("\n🔍 Verifying migration...\n");

  // Read games from both contracts
  const [oldGames, newGames] = await Promise.all([
    readAllGames(publicClient, oldContractAddress, "old contract"),
    readAllGames(publicClient, newContractAddress, "new contract"),
  ]);

  if (oldGames.length === 0) {
    console.log("⚠️  No games in old contract to verify");
    return [];
  }

  if (newGames.length === 0) {
    console.log("⚠️  No games in new contract to verify");
    return [];
  }

  // Create a map of new games by UUID for quick lookup
  const newGamesByUUID = new Map<string, GameData>();
  newGames.forEach((game) => {
    newGamesByUUID.set(game.uuid, game);
  });

  const results: VerificationResult[] = [];

  // Verify each old game exists in new contract
  for (const oldGame of oldGames) {
    const newGame = newGamesByUUID.get(oldGame.uuid);

    if (!newGame) {
      results.push({
        uuid: oldGame.uuid,
        oldTokenId: oldGame.tokenId,
        newTokenId: 0n,
        uriMatch: false,
        ownerMatch: false,
        oldUri: oldGame.uri,
        newUri: "",
        oldOwner: oldGame.owner,
        newOwner: "",
        status: "❌",
      });
      continue;
    }

    const uriMatch = oldGame.uri === newGame.uri;
    const ownerMatch = oldGame.owner === newGame.owner;

    results.push({
      uuid: oldGame.uuid,
      oldTokenId: oldGame.tokenId,
      newTokenId: newGame.tokenId,
      uriMatch,
      ownerMatch,
      oldUri: oldGame.uri,
      newUri: newGame.uri,
      oldOwner: oldGame.owner,
      newOwner: newGame.owner,
      status: uriMatch && ownerMatch ? "✅" : "❌",
    });
  }

  return results;
}

async function main() {
  console.log("🔍 Game Migration Verification Script");
  console.log("=".repeat(50));

  // Get old contract address
  const oldContractAddress = process.env.OLD_CONTRACT_ADDRESS;
  if (!oldContractAddress) {
    console.error("❌ Error: OLD_CONTRACT_ADDRESS environment variable is required");
    console.log(
      "Usage: export OLD_CONTRACT_ADDRESS=0x... && export NEW_CONTRACT_MODULE=CCGR && pnpm hardhat run scripts/verify-migration.ts --network <network>"
    );
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
    console.log(`🔗 Chain: ${chain.name} (${chain.id})\n`);

    // Create public client
    const publicClient = createPublicClient({
      chain: chain,
      transport: http(rpcUrl),
    });

    // Verify migration
    const results = await verifyMigration(
      publicClient,
      oldContractAddress,
      newContractAddress
    );

    if (results.length === 0) {
      console.log("\n⚠️  No games to verify");
      return;
    }

    // Print results
    console.log("\n" + "=".repeat(50));
    console.log("📊 Verification Results");
    console.log("=".repeat(50) + "\n");

    let successCount = 0;
    let failCount = 0;

    results.forEach((result) => {
      if (result.status === "✅") {
        successCount++;
        console.log(`\n${result.status} UUID: ${result.uuid}`);
        console.log(`   Old TokenID: ${result.oldTokenId} | New TokenID: ${result.newTokenId}`);
        console.log(`   ✅ URI matches: ${result.oldUri}`);
        console.log(`   ✅ Owner matches: ${result.oldOwner}`);
      } else {
        failCount++;
        console.log(`\n${result.status} UUID: ${result.uuid}`);
        console.log(`   Old TokenID: ${result.oldTokenId}`);
        if (result.newTokenId === 0n) {
          console.log(`   ❌ Game not found in new contract!`);
        } else {
          console.log(`   New TokenID: ${result.newTokenId}`);
        }
        if (!result.uriMatch) {
          console.log(`   ❌ URI mismatch:`);
          console.log(`      Old: ${result.oldUri}`);
          console.log(`      New: ${result.newUri}`);
        } else {
          console.log(`   ✅ URI matches: ${result.oldUri}`);
        }
        if (!result.ownerMatch) {
          console.log(`   ❌ Owner mismatch:`);
          console.log(`      Old: ${result.oldOwner}`);
          console.log(`      New: ${result.newOwner}`);
        } else {
          console.log(`   ✅ Owner matches: ${result.oldOwner}`);
        }
      }
    });

    console.log("\n" + "=".repeat(50));
    console.log("📈 Summary");
    console.log("=".repeat(50));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Total: ${results.length}`);

    if (failCount === 0) {
      console.log("\n🎉 All games migrated successfully!");
    } else {
      console.log(`\n⚠️  ${failCount} game(s) have issues. Please review above.`);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error during verification:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
