import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ERC20", (m) => {
  // ============ Deploy ChainCraftToken ============
  // Initial supply: 1,000,000,000 tokens (1 billion with 18 decimals)
  const initialSupply = m.getParameter("initialSupply", "1000000000000000000000000000"); // 1e27 = 1 billion * 1e18

  const token = m.contract("ChainCraftToken", [initialSupply], {
    id: "ChainCraftToken",
  });

  // ============ Return Deployed Contracts ============

  return {
    token,
  };
});
