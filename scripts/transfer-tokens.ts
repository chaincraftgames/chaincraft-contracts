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

// ERC20 ABI (minimal - just transfer function)
const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

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
        `Contract "${contractKey}" not found in deployment file for chain ${chainId}.\n` +
          `Available contracts:\n${availableContracts || "  (none found)"}\n` +
          `Use CONTRACT_MODULE environment variable to specify the module name (e.g., "ERC20" or "ERC20Dev")`
      );
    }

    return tokenAddress;
  } catch (error) {
    console.error("❌ Error reading deployment address:", error);
    throw error;
  }
}

async function main() {
  console.log("🪙 Transferring ChainCraftToken tokens...");

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  // Get network configuration
  const { chain, chainId, rpcUrl } = getNetworkConfig(hre);

  try {
    // Get token address from environment variable or deployment file
    let tokenAddress: string;
    const tokenAddressFromEnv = process.env.TOKEN_ADDR;
    const contractModule = process.env.CONTRACT_MODULE || "ERC20";

    if (tokenAddressFromEnv) {
      tokenAddress = tokenAddressFromEnv;
      console.log(`🪙 Using token address from TOKEN_ADDR: ${tokenAddress}`);
    } else {
      tokenAddress = getDeployedTokenAddress(chainId, contractModule);
      console.log(`📦 Using contract module: ${contractModule}`);
      console.log(`🪙 Using token address from deployment: ${tokenAddress}`);
    }

    console.log(`📋 Token Address: ${tokenAddress}`);
    console.log(`🔗 Chain: ${chain.name} (${chain.id})`);

    // Recipient addresses
    const recipients = [
      "0xe280ceccb23a6ebd420bb5A60f86596403e1D13C",
      "0x085a18376E26A1b90b9c51b4f51dd5485D843616",
    ];

    // Amount to transfer: 1000 tokens (with 18 decimals)
    const amount = BigInt("1000000000000000000000"); // 1000 * 10^18

    // Create account from private key
    const account = privateKeyToAccount(
      process.env.PRIVATE_KEY as `0x${string}`
    );
    console.log(`👤 Sender: ${account.address}`);

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
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      client: { public: publicClient, wallet: walletClient },
    });

    // Check sender balance
    const senderBalance = await contract.read.balanceOf([account.address]);
    console.log(`💰 Sender balance: ${senderBalance.toString()} tokens`);

    if (senderBalance < amount * BigInt(recipients.length)) {
      console.error(
        `❌ Error: Insufficient balance. Need ${(amount * BigInt(recipients.length)).toString()}, have ${senderBalance.toString()}`
      );
      process.exit(1);
    }

    // Transfer tokens to each recipient
    for (const recipient of recipients) {
      console.log(`\n📤 Transferring 1000 tokens to ${recipient}...`);

      const tx = await contract.write.transfer([
        recipient as `0x${string}`,
        amount,
      ]);

      console.log(`⏳ Transaction sent: ${tx}`);
      console.log("⏳ Waiting for confirmation...");

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      if (receipt.status === "success") {
        console.log(`✅ Transfer successful!`);
        console.log(`📄 Transaction hash: ${tx}`);

        // Show explorer link based on chain
        if (chainId === arbitrumSepolia.id) {
          console.log(`🔗 Explorer: https://sepolia.arbiscan.io/tx/${tx}`);
        } else if (chainId === sankoTestnet.id) {
          console.log(
            `🔗 Explorer: https://sanko-arb-sepolia.calderaexplorer.xyz/tx/${tx}`
          );
        }

        // Verify the transfer
        const recipientBalance = await contract.read.balanceOf([
          recipient as `0x${string}`,
        ]);
        console.log(
          `✅ Verification: Recipient balance is now ${recipientBalance.toString()} tokens`
        );
      } else {
        console.error(`❌ Transaction failed for ${recipient}!`);
        process.exit(1);
      }
    }

    console.log("\n✅ All transfers completed successfully!");
  } catch (error) {
    console.error("❌ Error transferring tokens:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
