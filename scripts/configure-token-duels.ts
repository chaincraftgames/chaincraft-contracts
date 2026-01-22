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

// TokenDuelsFacet ABI
const TOKEN_DUELS_FACET_ABI = [
  {
    type: "function",
    name: "configureToken",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
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

function getDeployedAddress(
  chainId: number,
  moduleName: string = "CCTD"
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

    const contractKey = `${moduleName}#CCTDDiamond`;
    const diamondAddress = deployedAddresses[contractKey];

    if (!diamondAddress) {
      // List available contracts to help the user
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

function getDeployedTokenAddress(
  chainId: number,
  moduleName: string = "ERC20"
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

    const contractKey = `${moduleName}#ChainCraftToken`;
    const tokenAddress = deployedAddresses[contractKey];

    if (!tokenAddress) {
      // List available contracts to help the user
      const availableContracts = Object.keys(deployedAddresses)
        .filter((key) => key.includes("ChainCraftToken"))
        .map((key) => `  - ${key}`)
        .join("\n");

      throw new Error(
        `Token "${contractKey}" not found in deployment file for chain ${chainId}.\n` +
          `Available tokens:\n${availableContracts || "  (none found)"}\n` +
          `Use TOKEN_MODULE environment variable to specify the token module name (e.g., "ERC20" or "ERC20Dev")`
      );
    }

    return tokenAddress;
  } catch (error) {
    console.error("❌ Error reading token deployment address:", error);
    throw error;
  }
}

async function main() {
  console.log("⚙️  Configuring TokenDuelsFacet with ERC20 token...");

  // Get the token address from environment variable or deployment
  const tokenAddressFromEnv = process.env.TOKEN_ADDR;
  const tokenModule = process.env.TOKEN_MODULE || "ERC20";

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  // Get contract module name (defaults to "CCTD" for backward compatibility)
  const contractModule = process.env.CONTRACT_MODULE || "CCTD";
  console.log(`📦 Using contract module: ${contractModule}`);
  console.log(`🪙 Using token module: ${tokenModule}`);

  // Get network configuration
  const { chain, chainId, rpcUrl } = getNetworkConfig(hre);

  try {
    // Get deployed contract address for the chain
    const contractAddress = getDeployedAddress(chainId, contractModule);
    console.log(`📋 CCTDDiamond Address: ${contractAddress}`);
    console.log(`🔗 Chain: ${chain.name} (${chain.id})`);

    // Get token address
    let tokenAddress: string;
    if (tokenAddressFromEnv) {
      tokenAddress = tokenAddressFromEnv;
      console.log(`🪙 Using token address from TOKEN_ADDR: ${tokenAddress}`);
    } else {
      tokenAddress = getDeployedTokenAddress(chainId, tokenModule);
      console.log(
        `🪙 Using token address from deployment (${tokenModule}): ${tokenAddress}`
      );
    }

    // Create account from private key
    const account = privateKeyToAccount(
      process.env.PRIVATE_KEY as `0x${string}`
    );
    console.log(`👤 Configurer: ${account.address}`);

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
      abi: TOKEN_DUELS_FACET_ABI,
      client: { public: publicClient, wallet: walletClient },
    });

    // Check current configuration
    console.log("🔍 Checking current configuration...");
    try {
      const [currentToken, currentDecimals] = await contract.read.configuredToken();
      if (currentToken !== "0x0000000000000000000000000000000000000000") {
        console.log(
          `⚠️  Token already configured: ${currentToken} (${currentDecimals} decimals)`
        );
        console.log(
          "   If you want to reconfigure, this will overwrite the existing configuration."
        );
      }
    } catch (error) {
      // Token not set yet, which is fine
      console.log("   No token configured yet.");
    }

    // Configure token
    console.log(`📝 Configuring token: ${tokenAddress}...`);
    const tx = await contract.write.configureToken([
      tokenAddress as `0x${string}`,
    ]);

    console.log(`⏳ Transaction sent: ${tx}`);
    console.log("⏳ Waiting for confirmation...");

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === "success") {
      console.log("✅ Token configured successfully!");
      console.log(`📄 Transaction hash: ${tx}`);

      // Show explorer link based on chain
      if (chainId === arbitrumSepolia.id) {
        console.log(`🔗 Explorer: https://sepolia.arbiscan.io/tx/${tx}`);
      } else if (chainId === sankoTestnet.id) {
        console.log(
          `🔗 Explorer: https://sanko-arb-sepolia.calderaexplorer.xyz/tx/${tx}`
        );
      }

      // Verify the configuration
      const [configuredToken, decimals] = await contract.read.configuredToken();
      const stakeAmount = await contract.read.stakeAmount();

      console.log(`\n✅ Verification:`);
      console.log(`   Token: ${configuredToken}`);
      console.log(`   Decimals: ${decimals}`);
      console.log(`   Stake Amount: ${stakeAmount.toString()} (10 tokens)`);
    } else {
      console.error("❌ Transaction failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error configuring token:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
