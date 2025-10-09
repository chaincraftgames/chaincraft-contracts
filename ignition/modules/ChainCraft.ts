import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

enum FacetCutAction {
  Add,
  Replace,
  Remove,
}

// Helper function to extract function selectors from ABI (like in your example)
function getFunctionSelectors(abi: any[]): string[] {
  return abi
    .filter((item) => item.type === "function")
    .map((func) => {
      const signature = `${func.name}(${func.inputs
        .map((input: any) => input.type)
        .join(",")})`;
      return toFunctionSelector(signature);
    });
}

export default buildModule("ChainCraft", (m) => {
  // Deploy the Diamond contract first
  const diamond = m.contract("ChainCraftDiamond", [], {
    id: "ChainCraftDiamond",
  });

  // Deploy the GameRegistryFacet
  const gameRegistryFacet = m.contract("GameRegistryFacet", [], {
    id: "GameRegistryFacet",
  });

  // Load ABIs for both contracts
  const gameRegistryAbi =
    require("../../artifacts/contracts/GameRegistryFacet.sol/GameRegistryFacet.json").abi;
  const diamondAbi =
    require("../../artifacts/contracts/ChainCraftDiamond.sol/ChainCraftDiamond.json").abi;

  // Get selectors for GameRegistryFacet
  const allSelectors = getFunctionSelectors(gameRegistryAbi);

  // Get selectors that are already added by the diamond (from SolidstateDiamondProxy)
  const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

  // Filter out selectors that are already added by the diamond
  const gameRegistrySelectors = allSelectors.filter(
    (selector) => !alreadyAddedSelectors.includes(selector)
  );

  // Add GameRegistryFacet to the diamond
  m.call(
    diamond,
    "diamondCut",
    [
      [
        {
          target: gameRegistryFacet,
          action: FacetCutAction.Add,
          selectors: gameRegistrySelectors,
        },
      ],
      "0x0000000000000000000000000000000000000000",
      "0x",
    ],
    { id: "DiamondCut" }
  );

  // Get GameRegistryFacet interface at diamond address for initialization
  const gameRegistry = m.contractAt("GameRegistryFacet", diamond, {
    id: "GameRegistry",
  });

  // Initialize the GameRegistry
  m.call(gameRegistry, "initialize", ["ChainCraft Game Registry", "CCGR"], {
    id: "Initialize",
  });

  return {
    diamond,
    gameRegistryFacet,
    gameRegistry,
  };
});
