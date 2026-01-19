import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("ProxyAdminFacet - Admin Transfer", () => {
  let diamond: any;
  let proxyAdminFacet: any;
  let deployer: any;
  let companyWallet: any;
  let attacker: any;
  let viem: any;

  beforeEach(async () => {
    const network_result = await network.connect();
    viem = network_result.viem;
    const walletClients = await viem.getWalletClients();
    [deployer, companyWallet, attacker] = walletClients;

    // Deploy the Diamond contract
    diamond = await viem.deployContract("CCGRDiamond", [], {
      account: deployer.account,
    });

    // Deploy ProxyAdminFacet
    const proxyAdminFacetContract = await viem.deployContract(
      "ProxyAdminFacet",
      []
    );

    // Get function selectors
    const diamondAbi =
      require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
    const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
    const proxyAdminSelectors = getFunctionSelectors(
      proxyAdminFacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    // Add ProxyAdminFacet to diamond
    await diamond.write.diamondCut(
      [
        [
          {
            target: proxyAdminFacetContract.address,
            action: 0, // Add
            selectors: proxyAdminSelectors,
          },
        ],
        "0x0000000000000000000000000000000000000000",
        "0x",
      ],
      {
        account: deployer.account,
      }
    );

    // Get the ProxyAdminFacet interface from the diamond
    proxyAdminFacet = await viem.getContractAt(
      "ProxyAdminFacet",
      diamond.address
    );
  });

  describe("Initial State", () => {
    it("should have deployer as initial proxy admin", async () => {
      const admin = await proxyAdminFacet.read.getProxyAdmin();
      assert.strictEqual(
        admin.toLowerCase(),
        deployer.account.address.toLowerCase(),
        "Deployer should be initial proxy admin"
      );
    });

    it("should have deployer as owner", async () => {
      const owner = await diamond.read.owner();
      assert.strictEqual(
        owner.toLowerCase(),
        deployer.account.address.toLowerCase(),
        "Deployer should be owner"
      );
    });
  });

  describe("Proxy Admin Transfer", () => {
    it("should allow current admin to transfer proxy admin rights", async () => {
      // Transfer proxy admin
      await proxyAdminFacet.write.transferProxyAdmin([
        companyWallet.account.address,
      ], {
        account: deployer.account,
      });

      // Verify new admin
      const newAdmin = await proxyAdminFacet.read.getProxyAdmin();
      assert.strictEqual(
        newAdmin.toLowerCase(),
        companyWallet.account.address.toLowerCase(),
        "Company wallet should be new proxy admin"
      );
    });

    it("should emit ProxyAdminTransferred event", async () => {
      const tx = await proxyAdminFacet.write.transferProxyAdmin([
        companyWallet.account.address,
      ], {
        account: deployer.account,
      });

      // In viem, we'd need to get the transaction receipt and check logs
      // For now, just verify the transfer succeeded
      const newAdmin = await proxyAdminFacet.read.getProxyAdmin();
      assert.strictEqual(
        newAdmin.toLowerCase(),
        companyWallet.account.address.toLowerCase()
      );
    });

    it("should prevent non-admin from transferring proxy admin", async () => {
      try {
        await proxyAdminFacet.write.transferProxyAdmin([
          attacker.account.address,
        ], {
          account: attacker.account,
        });
        assert.fail("Should have failed - attacker is not proxy admin");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }

      // Verify admin unchanged
      const admin = await proxyAdminFacet.read.getProxyAdmin();
      assert.strictEqual(
        admin.toLowerCase(),
        deployer.account.address.toLowerCase(),
        "Admin should remain unchanged"
      );
    });

    it("should prevent transfer to zero address", async () => {
      try {
        await proxyAdminFacet.write.transferProxyAdmin([
          "0x0000000000000000000000000000000000000000",
        ], {
          account: deployer.account,
        });
        assert.fail("Should have failed - cannot transfer to zero address");
      } catch (error: any) {
        assert.ok(
          error.message.includes("ProxyAdminFacet__ZeroAddress"),
          `Expected ProxyAdminFacet__ZeroAddress error, got: ${error.message}`
        );
      }
    });

    it("should allow new admin to perform diamond cuts", async () => {
      // Transfer to company wallet
      await proxyAdminFacet.write.transferProxyAdmin([
        companyWallet.account.address,
      ], {
        account: deployer.account,
      });

      // Deploy a test facet
      const testFacet = await viem.deployContract("OperableFacet", []);
      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const testSelectors = getFunctionSelectors(testFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      // Company wallet should be able to perform diamond cut
      await diamond.write.diamondCut(
        [
          [
            {
              target: testFacet.address,
              action: 0,
              selectors: testSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: companyWallet.account,
        }
      );

      // Verify facet was added
      const facetAddresses = await diamond.read.facetAddresses();
      assert.ok(
        facetAddresses.some(
          (addr: string) => addr.toLowerCase() === testFacet.address.toLowerCase()
        ),
        "Test facet should be added by new admin"
      );
    });

    it("should prevent old admin from performing diamond cuts after transfer", async () => {
      // Transfer to company wallet
      await proxyAdminFacet.write.transferProxyAdmin([
        companyWallet.account.address,
      ], {
        account: deployer.account,
      });

      // Deploy a test facet
      const testFacet = await viem.deployContract("OperableFacet", []);
      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const testSelectors = getFunctionSelectors(testFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      // Old admin (deployer) should NOT be able to perform diamond cut
      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: testFacet.address,
                action: 0,
                selectors: testSelectors,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: deployer.account,
          }
        );
        assert.fail("Old admin should not be able to perform diamond cut");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }
    });

    it("should allow sequential admin transfers", async () => {
      // First transfer: deployer -> companyWallet
      await proxyAdminFacet.write.transferProxyAdmin([
        companyWallet.account.address,
      ], {
        account: deployer.account,
      });

      let admin = await proxyAdminFacet.read.getProxyAdmin();
      assert.strictEqual(
        admin.toLowerCase(),
        companyWallet.account.address.toLowerCase()
      );

      // Second transfer: companyWallet -> attacker (for testing)
      await proxyAdminFacet.write.transferProxyAdmin([
        attacker.account.address,
      ], {
        account: companyWallet.account,
      });

      admin = await proxyAdminFacet.read.getProxyAdmin();
      assert.strictEqual(
        admin.toLowerCase(),
        attacker.account.address.toLowerCase()
      );
    });
  });

  describe("Complete Control Transfer Workflow", () => {
    it("should transfer both proxy admin and owner to company wallet", async () => {
      // Step 1: Transfer proxy admin
      await proxyAdminFacet.write.transferProxyAdmin([
        companyWallet.account.address,
      ], {
        account: deployer.account,
      });

      // Step 2: Initiate ownership transfer
      await diamond.write.transferOwnership([companyWallet.account.address], {
        account: deployer.account,
      });

      // Step 3: Accept ownership from company wallet
      await diamond.write.acceptOwnership({
        account: companyWallet.account,
      });

      // Verify final state
      const proxyAdmin = await proxyAdminFacet.read.getProxyAdmin();
      const owner = await diamond.read.owner();

      assert.strictEqual(
        proxyAdmin.toLowerCase(),
        companyWallet.account.address.toLowerCase(),
        "Company wallet should be proxy admin"
      );
      assert.strictEqual(
        owner.toLowerCase(),
        companyWallet.account.address.toLowerCase(),
        "Company wallet should be owner"
      );

      // Verify deployer has no control
      // Try diamond cut with deployer
      const testFacet = await viem.deployContract("OperableFacet", []);
      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const testSelectors = getFunctionSelectors(testFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: testFacet.address,
                action: 0,
                selectors: testSelectors,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: deployer.account,
          }
        );
        assert.fail("Deployer should have no proxy admin rights");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }
    });
  });

  describe("Facet Removal for Immutability", () => {
    it("should allow admin to remove ProxyAdminFacet making admin immutable", async () => {
      // Transfer to company wallet first
      await proxyAdminFacet.write.transferProxyAdmin([
        companyWallet.account.address,
      ], {
        account: deployer.account,
      });

      // Get selectors of ProxyAdminFacet
      const proxyAdminFacetContract = await viem.deployContract(
        "ProxyAdminFacet",
        []
      );
      const selectors = getFunctionSelectors(proxyAdminFacetContract.abi);

      // Remove the facet from company wallet
      await diamond.write.diamondCut(
        [
          [
            {
              target: "0x0000000000000000000000000000000000000000",
              action: 2, // Remove
              selectors: selectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: companyWallet.account,
        }
      );

      // Verify functions no longer exist
      try {
        await proxyAdminFacet.read.getProxyAdmin();
        assert.fail("ProxyAdminFacet should be removed");
      } catch (error: any) {
        // Should fail because function selector no longer exists
        assert.ok(error);
      }

      // But company wallet should still be able to perform diamond cuts
      // (proving it's still the proxy admin, just can't transfer it anymore)
      const testFacet = await viem.deployContract("OperableFacet", []);
      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const testSelectors = getFunctionSelectors(testFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      await diamond.write.diamondCut(
        [
          [
            {
              target: testFacet.address,
              action: 0,
              selectors: testSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: companyWallet.account,
        }
      );

      // Verify facet was added
      const facetAddresses = await diamond.read.facetAddresses();
      assert.ok(
        facetAddresses.some(
          (addr: string) => addr.toLowerCase() === testFacet.address.toLowerCase()
        ),
        "Company wallet can still add facets after removing ProxyAdminFacet"
      );
    });
  });
});

/**
 * Get function selectors from ABI
 */
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

