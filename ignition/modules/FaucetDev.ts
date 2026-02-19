import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("FaucetDev", (m) => {
  // ============ Get Configuration from Environment ============
  // Token address - from env or parameter (dev version)
  const tokenAddress = 
    process.env.FAUCET_TOKEN_ADDRESS || 
    m.getParameter("tokenAddress", "0x0000000000000000000000000000000000000000");

  // Orchestrator operator address - from env or parameter
  const orchestratorAddress = 
    process.env.ORCHESTRATOR_OPERATOR_ADDRESS || 
    m.getParameter("orchestratorAddress", "0x0000000000000000000000000000000000000000");

  // ============ Deploy TokenFaucet ============
  const faucet = m.contract("TokenFaucet", [tokenAddress], {
    id: "TokenFaucet",
  });

  // ============ Add Orchestrator as Operator ============
  if (orchestratorAddress && orchestratorAddress !== "0x0000000000000000000000000000000000000000") {
    m.call(faucet, "addOperator", [orchestratorAddress], {
      id: "AddOrchestratorOperator",
    });
  }

  // ============ Return Deployed Contracts ============

  return {
    faucet,
  };
});
