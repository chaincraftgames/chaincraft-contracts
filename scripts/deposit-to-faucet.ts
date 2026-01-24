import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, getNetworkConfig } from "../utils/chains.js";
import hre from "hardhat";

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
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

const FAUCET_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "token",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  const faucetAddress = process.env.FAUCET_ADDRESS;
  const amount = process.env.AMOUNT || "1000000000000000000000"; // Default: 1000 tokens (1000 * 10^18)
  
  if (!faucetAddress) {
    throw new Error("FAUCET_ADDRESS environment variable is required");
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const { chain, rpcUrl } = getNetworkConfig(hre);

  const publicClient = createPublicClient({
    chain: chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: chain,
    transport: http(rpcUrl),
  });

  console.log("💰 Depositing tokens to faucet...\n");
  console.log(`📋 Faucet Address: ${faucetAddress}`);
  console.log(`👤 Depositor: ${account.address}`);
  console.log(`💵 Amount: ${amount} wei (${Number(amount) / 1e18} tokens)\n`);

  // Get token address from faucet
  const faucetContract = getContract({
    address: faucetAddress as `0x${string}`,
    abi: FAUCET_ABI,
    client: { public: publicClient },
  });

  const tokenAddress = await faucetContract.read.token();
  console.log(`🪙 Token Address: ${tokenAddress}\n`);

  // Check balance
  const tokenContract = getContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    client: { public: publicClient },
  });

  const balance = await tokenContract.read.balanceOf([account.address]);
  console.log(`📊 Your Token Balance: ${balance.toString()} wei (${Number(balance) / 1e18} tokens)`);

  if (BigInt(balance) < BigInt(amount)) {
    throw new Error(`Insufficient balance. You have ${Number(balance) / 1e18} tokens but need ${Number(amount) / 1e18} tokens`);
  }

  // Approve faucet to spend tokens
  console.log("\n1️⃣ Approving faucet to spend tokens...");
  const approveHash = await walletClient.writeContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [faucetAddress as `0x${string}`, BigInt(amount)],
  });

  console.log(`   Transaction: ${approveHash}`);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("   ✅ Approved\n");

  // Deposit to faucet
  console.log("2️⃣ Depositing tokens to faucet...");
  const depositHash = await walletClient.writeContract({
    address: faucetAddress as `0x${string}`,
    abi: FAUCET_ABI,
    functionName: "deposit",
    args: [BigInt(amount)],
  });

  console.log(`   Transaction: ${depositHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log("   ✅ Deposited\n");

  // Check faucet balance
  const faucetBalance = await tokenContract.read.balanceOf([faucetAddress as `0x${string}`]);
  console.log(`📊 New Faucet Balance: ${faucetBalance.toString()} wei (${Number(faucetBalance) / 1e18} tokens)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message || error);
    process.exit(1);
  });
