import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

enum FacetCutAction {
  Add,
  Replace,
  Remove,
}

// Helper function to extract function selectors from ABI
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
  // ============ Deploy Diamond ============
  const diamond = m.contract("ChainCraftDiamond", [], {
    id: "ChainCraftDiamond",
  });

  // ============ Deploy Facets ============

  // Deploy OperableFacet
  const operableFacet = m.contract("OperableFacet", [], {
    id: "OperableFacet",
  });

  // Deploy GameRegistryFacet
  const gameRegistryFacet = m.contract("GameRegistryFacet", [], {
    id: "GameRegistryFacet",
  });

  // ============ Load ABIs ============

  const operableFacetAbi =
    require("../../artifacts/contracts/facets/OperableFacet/OperableFacet.sol/OperableFacet.json").abi;

  const gameRegistryFacetAbi =
    require("../../artifacts/contracts/facets/GameRegistryFacet/GameRegistryFacet.sol/GameRegistryFacet.json").abi;

  const diamondAbi =
    require("../../artifacts/contracts/ChainCraftDiamond.sol/ChainCraftDiamond.json").abi;

  // ============ Get Function Selectors ============

  // Get selectors for OperableFacet
  const operableFacetSelectors = getFunctionSelectors(operableFacetAbi);

  // Get selectors for GameRegistryFacet
  const gameRegistryFacetSelectors = getFunctionSelectors(gameRegistryFacetAbi);

  // Get selectors already added by the diamond (from SafeOwnable, etc.)
  const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

  // ============ Filter Out Duplicate Selectors ============

  // Filter out selectors that are already added by the diamond
  const operableFacetSelectorsFiltered = operableFacetSelectors.filter(
    (selector) => !alreadyAddedSelectors.includes(selector)
  );

  const gameRegistryFacetSelectorsFiltered = gameRegistryFacetSelectors.filter(
    (selector) => !alreadyAddedSelectors.includes(selector)
  );

  // ============ Diamond Cut - Add Facets ============

  m.call(
    diamond,
    "diamondCut",
    [
      [
        {
          target: operableFacet,
          action: FacetCutAction.Add,
          selectors: operableFacetSelectorsFiltered,
        },
        {
          target: gameRegistryFacet,
          action: FacetCutAction.Add,
          selectors: gameRegistryFacetSelectorsFiltered,
        },
      ],
      "0x0000000000000000000000000000000000000000",
      "0x",
    ],
    { id: "DiamondCut" }
  );

  // ============ Get Facet Interfaces at Diamond Address ============

  const operableFacetInterface = m.contractAt("OperableFacet", diamond, {
    id: "OperableFacetInterface",
  });

  const gameRegistryFacetInterface = m.contractAt(
    "GameRegistryFacet",
    diamond,
    {
      id: "GameRegistryFacetInterface",
    }
  );

  // ============ Initialize GameRegistry ============

  m.call(
    gameRegistryFacetInterface,
    "initialize",
    ["ChainCraft Games", "CCG"],
    {
      id: "Initialize",
    }
  );

  // ============ Return Deployed Contracts ============

  return {
    diamond,
    operableFacet,
    operableFacetInterface,
    gameRegistryFacet,
    gameRegistryFacetInterface,
  };
});
