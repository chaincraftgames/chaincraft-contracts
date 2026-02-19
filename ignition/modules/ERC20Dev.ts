import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ERC20Dev", (m) => {
  // ============ Deploy ChainCraftToken ============
  // Initial supply: 1,000,000 tokens (1 million with 18 decimals) for dev/testing
  const initialSupply = m.getParameter("initialSupply", "1000000000000000000000000"); // 1e24 = 1 million * 1e18

  const token = m.contract("ChainCraftToken", [initialSupply], {
    id: "ChainCraftToken",
  });

  // ============ Return Deployed Contracts ============

  return {
    token,
  };
});
