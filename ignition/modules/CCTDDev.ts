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

export default buildModule("CCTDDev", (m) => {
  // ============ Deploy Diamond ============
  const diamond = m.contract("CCTDDiamond", [], {
    id: "CCTDDiamond",
  });

  // ============ Deploy Facets ============

  // Deploy OperableFacet
  const operableFacet = m.contract("OperableFacet", [], {
    id: "OperableFacet",
  });

  // Deploy TokenDuelsFacet
  const tokenDuelsFacet = m.contract("TokenDuelsFacet", [], {
    id: "TokenDuelsFacet",
  });

  // ============ Load ABIs ============

  const operableFacetAbi =
    require("../../artifacts/contracts/facets/OperableFacet/OperableFacet.sol/OperableFacet.json").abi;

  const tokenDuelsFacetAbi =
    require("../../artifacts/contracts/facets/TokenDuelsFacet/TokenDuelsFacet.sol/TokenDuelsFacet.json").abi;

  const diamondAbi =
    require("../../artifacts/contracts/CCTDDiamond.sol/CCTDDiamond.json").abi;

  // ============ Get Function Selectors ============

  // Get selectors for OperableFacet
  const operableFacetSelectors = getFunctionSelectors(operableFacetAbi);

  // Get selectors for TokenDuelsFacet
  const tokenDuelsFacetSelectors = getFunctionSelectors(tokenDuelsFacetAbi);

  // Get selectors already added by the diamond (from SafeOwnable, etc.)
  const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

  // ============ Filter Out Duplicate Selectors ============

  // Filter out selectors that are already added by the diamond
  const operableFacetSelectorsFiltered = operableFacetSelectors.filter(
    (selector) => !alreadyAddedSelectors.includes(selector)
  );

  const tokenDuelsFacetSelectorsFiltered = tokenDuelsFacetSelectors.filter(
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
          target: tokenDuelsFacet,
          action: FacetCutAction.Add,
          selectors: tokenDuelsFacetSelectorsFiltered,
        },
      ],
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x",
    ],
    { id: "DiamondCut" }
  );

  // ============ Return Deployed Contracts ============

  return {
    diamond,
    operableFacet,
    tokenDuelsFacet,
  };
});
