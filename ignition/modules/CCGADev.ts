import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

enum FacetCutAction {
  Add,
  Replace,
  Remove,
}

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

export default buildModule("CCGADev", (m) => {
  // ============ Deploy Diamond ============
  const diamond = m.contract("CCGADiamond", [], {
    id: "CCGADiamond",
  });

  // ============ Deploy Facets ============

  // Deploy OperableFacet
  const operableFacet = m.contract("OperableFacet", [], {
    id: "OperableFacet",
  });

  // Deploy EIP712Facet
  const eip712Facet = m.contract("EIP712Facet", [], {
    id: "EIP712Facet",
  });

  // Deploy GameAssetFacet
  const gameAssetFacet = m.contract("GameAssetFacet", [], {
    id: "GameAssetFacet",
  });

  // ============ Load ABIs ============

  const operableFacetAbi =
    require("../../artifacts/contracts/facets/OperableFacet/OperableFacet.sol/OperableFacet.json").abi;

  const eip712FacetAbi =
    require("../../artifacts/contracts/facets/EIP712Facet/EIP712Facet.sol/EIP712Facet.json").abi;

  const gameAssetFacetAbi =
    require("../../artifacts/contracts/facets/GameAssetFacet/GameAssetFacet.sol/GameAssetFacet.json").abi;

  const diamondAbi =
    require("../../artifacts/contracts/CCGADiamond.sol/CCGADiamond.json").abi;

  // ============ Get Function Selectors ============

  const operableFacetSelectors = getFunctionSelectors(operableFacetAbi);
  const eip712FacetSelectors = getFunctionSelectors(eip712FacetAbi);
  const gameAssetFacetSelectors = getFunctionSelectors(gameAssetFacetAbi);

  // Get selectors already added by the diamond (from SafeOwnable, etc.)
  const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

  // ============ Filter Out Duplicate Selectors ============

  const operableFacetSelectorsFiltered = operableFacetSelectors.filter(
    (selector) => !alreadyAddedSelectors.includes(selector)
  );

  const eip712FacetSelectorsFiltered = eip712FacetSelectors.filter(
    (selector) => !alreadyAddedSelectors.includes(selector)
  );

  const gameAssetFacetSelectorsFiltered = gameAssetFacetSelectors.filter(
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
          target: eip712Facet,
          action: FacetCutAction.Add,
          selectors: eip712FacetSelectorsFiltered,
        },
        {
          target: gameAssetFacet,
          action: FacetCutAction.Add,
          selectors: gameAssetFacetSelectorsFiltered,
        },
      ],
      "0x0000000000000000000000000000000000000000",
      "0x",
    ],
    { id: "DiamondCut" }
  );

  // ============ Initialize CCGA ============

  const gameAssetAtDiamond = m.contractAt("GameAssetFacet", diamond, {
    id: "DiamondAsCCGA",
  });

  m.call(gameAssetAtDiamond, "initialize", ["ChainCraft Assets", "CCGA"], {
    id: "Initialize",
  });

  // ============ Return Deployed Contracts ============

  return {
    diamond,
    operableFacet,
    eip712Facet,
    gameAssetFacet,
  };
});
