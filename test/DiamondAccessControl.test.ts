import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("Diamond Access Control", () => {
  let diamond: any;
  let deployer: any;
  let attacker: any;
  let user1: any;
  let user2: any;
  let viem: any;

  beforeEach(async () => {
    const network_result = await network.connect();
    viem = network_result.viem;
    const walletClients = await viem.getWalletClients();
    [deployer, attacker, user1, user2] = walletClients;

    // Deploy the Diamond contract
    // The deployer will be both the proxy admin and the owner
    diamond = await viem.deployContract("CCGRDiamond", [], {
      account: deployer.account,
    });
  });

  describe("diamondCut Access Control", () => {
    it("should allow proxy admin (deployer) to perform diamond cut", async () => {
      // Deploy a test facet
      const operableFacet = await viem.deployContract("OperableFacet", []);

      // Get function selectors
      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const operableFacetSelectors = getFunctionSelectors(
        operableFacet.abi
      ).filter((selector) => !alreadyAddedSelectors.includes(selector));

      // This should succeed because deployer is the proxy admin
      await diamond.write.diamondCut(
        [
          [
            {
              target: operableFacet.address,
              action: 0, // Add
              selectors: operableFacetSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: deployer.account,
        }
      );

      // Verify the facet was added by checking facet addresses
      const facetAddresses = await diamond.read.facetAddresses();
      assert.ok(
        facetAddresses.some(
          (addr: string) =>
            addr.toLowerCase() === operableFacet.address.toLowerCase()
        ),
        "Facet should be added to diamond"
      );
    });

    it("should prevent non-admin (attacker) from performing diamond cut", async () => {
      // Deploy a malicious facet
      const maliciousFacet = await viem.deployContract("OperableFacet", []);

      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const maliciousFacetSelectors = getFunctionSelectors(
        maliciousFacet.abi
      ).filter((selector) => !alreadyAddedSelectors.includes(selector));

      try {
        // Attempt diamond cut from attacker account
        await diamond.write.diamondCut(
          [
            [
              {
                target: maliciousFacet.address,
                action: 0, // Add
                selectors: maliciousFacetSelectors,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: attacker.account,
          }
        );
        assert.fail("Should have failed - attacker is not proxy admin");
      } catch (error: any) {
        // Should revert with Proxy__SenderIsNotAdmin
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }

      // Verify the facet was NOT added
      const facetAddresses = await diamond.read.facetAddresses();
      assert.ok(
        !facetAddresses.some(
          (addr: string) =>
            addr.toLowerCase() === maliciousFacet.address.toLowerCase()
        ),
        "Malicious facet should not be added to diamond"
      );
    });

    it("should prevent regular user from performing diamond cut", async () => {
      const testFacet = await viem.deployContract("OperableFacet", []);

      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const testFacetSelectors = getFunctionSelectors(testFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: testFacet.address,
                action: 0, // Add
                selectors: testFacetSelectors,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: user1.account,
          }
        );
        assert.fail("Should have failed - user1 is not proxy admin");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }
    });

    it("should prevent replacing existing facets by unauthorized user", async () => {
      // First, add a facet as admin
      const originalFacet = await viem.deployContract("OperableFacet", []);

      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const facetSelectors = getFunctionSelectors(originalFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      await diamond.write.diamondCut(
        [
          [
            {
              target: originalFacet.address,
              action: 0, // Add
              selectors: facetSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: deployer.account,
        }
      );

      // Now try to replace it from attacker account
      const replacementFacet = await viem.deployContract("OperableFacet", []);

      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: replacementFacet.address,
                action: 1, // Replace
                selectors: facetSelectors,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: attacker.account,
          }
        );
        assert.fail("Should have failed - attacker cannot replace facets");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }
    });

    it("should prevent removing facets by unauthorized user", async () => {
      // First, add a facet as admin
      const facetToRemove = await viem.deployContract("OperableFacet", []);

      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const facetSelectors = getFunctionSelectors(facetToRemove.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      await diamond.write.diamondCut(
        [
          [
            {
              target: facetToRemove.address,
              action: 0, // Add
              selectors: facetSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: deployer.account,
        }
      );

      // Now try to remove it from attacker account
      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: "0x0000000000000000000000000000000000000000",
                action: 2, // Remove
                selectors: facetSelectors,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: attacker.account,
          }
        );
        assert.fail("Should have failed - attacker cannot remove facets");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }

      // Verify facet still exists
      const facetAddresses = await diamond.read.facetAddresses();
      assert.ok(
        facetAddresses.some(
          (addr: string) =>
            addr.toLowerCase() === facetToRemove.address.toLowerCase()
        ),
        "Facet should still be present"
      );
    });
  });

  describe("setFallbackAddress Access Control", () => {
    it("should allow proxy admin to set fallback address", async () => {
      // Deploy a simple contract to use as fallback
      const fallbackContract = await viem.deployContract("OperableFacet", []);

      // This should succeed because deployer is the proxy admin
      await diamond.write.setFallbackAddress([fallbackContract.address], {
        account: deployer.account,
      });

      // Verify the fallback was set
      const fallbackAddress = await diamond.read.getFallbackAddress();
      assert.strictEqual(
        fallbackAddress.toLowerCase(),
        fallbackContract.address.toLowerCase(),
        "Fallback address should be set"
      );
    });

    it("should prevent non-admin from setting fallback address", async () => {
      const maliciousContract = await viem.deployContract("OperableFacet", []);

      try {
        await diamond.write.setFallbackAddress([maliciousContract.address], {
          account: attacker.account,
        });
        assert.fail("Should have failed - attacker is not proxy admin");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }

      // Verify the fallback was NOT changed
      const fallbackAddress = await diamond.read.getFallbackAddress();
      assert.notStrictEqual(
        fallbackAddress.toLowerCase(),
        maliciousContract.address.toLowerCase(),
        "Fallback address should not be set by attacker"
      );
    });

    it("should prevent regular user from setting fallback address", async () => {
      const userContract = await viem.deployContract("OperableFacet", []);

      try {
        await diamond.write.setFallbackAddress([userContract.address], {
          account: user1.account,
        });
        assert.fail("Should have failed - user1 is not proxy admin");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Proxy__SenderIsNotAdmin"),
          `Expected Proxy__SenderIsNotAdmin error, got: ${error.message}`
        );
      }
    });

    it("should prevent multiple unauthorized users from setting fallback address", async () => {
      const contract1 = await viem.deployContract("OperableFacet", []);
      const contract2 = await viem.deployContract("OperableFacet", []);

      // Try with attacker
      try {
        await diamond.write.setFallbackAddress([contract1.address], {
          account: attacker.account,
        });
        assert.fail("Attacker should not be able to set fallback");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }

      // Try with user1
      try {
        await diamond.write.setFallbackAddress([contract2.address], {
          account: user1.account,
        });
        assert.fail("User1 should not be able to set fallback");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }

      // Try with user2
      try {
        await diamond.write.setFallbackAddress([contract2.address], {
          account: user2.account,
        });
        assert.fail("User2 should not be able to set fallback");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }
    });
  });

  describe("Combined Attack Scenarios", () => {
    it("should prevent attacker from adding malicious facet and taking control", async () => {
      // Scenario: Attacker tries to add a malicious facet that could drain funds or take control
      const maliciousFacet = await viem.deployContract("GameRegistryFacet", []);

      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const maliciousSelectors = getFunctionSelectors(
        maliciousFacet.abi
      ).filter((selector) => !alreadyAddedSelectors.includes(selector));

      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: maliciousFacet.address,
                action: 0,
                selectors: maliciousSelectors,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: attacker.account,
          }
        );
        assert.fail("Attacker should not be able to add malicious facet");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }
    });

    it("should prevent attacker from setting malicious fallback and redirecting calls", async () => {
      // Scenario: Attacker tries to set a malicious fallback to intercept unknown function calls
      const maliciousFallback = await viem.deployContract("OperableFacet", []);

      try {
        await diamond.write.setFallbackAddress([maliciousFallback.address], {
          account: attacker.account,
        });
        assert.fail("Attacker should not be able to set malicious fallback");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }
    });

    it("should prevent coordinated attack from multiple unauthorized addresses", async () => {
      // Scenario: Multiple attackers try to exploit the diamond in sequence
      const facet1 = await viem.deployContract("OperableFacet", []);
      const facet2 = await viem.deployContract("GameRegistryFacet", []);

      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

      // First attacker tries to add a facet
      const selectors1 = getFunctionSelectors(facet1.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: facet1.address,
                action: 0,
                selectors: selectors1,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: attacker.account,
          }
        );
        assert.fail("First attacker should fail");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }

      // Second attacker (user1) tries to add a different facet
      const selectors2 = getFunctionSelectors(facet2.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: facet2.address,
                action: 0,
                selectors: selectors2,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: user1.account,
          }
        );
        assert.fail("Second attacker should fail");
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }

      // Verify no unauthorized facets were added
      const facetAddresses = await diamond.read.facetAddresses();
      assert.ok(!facetAddresses.includes(facet1.address));
      assert.ok(!facetAddresses.includes(facet2.address));
    });
  });

  describe("Admin vs Owner Separation", () => {
    it("should verify deployer is both proxy admin and owner initially", async () => {
      // The deployer should be the owner (via SafeOwnable)
      const owner = await diamond.read.owner();
      assert.strictEqual(
        owner.toLowerCase(),
        deployer.account.address.toLowerCase(),
        "Deployer should be the owner"
      );

      // The deployer should also be able to perform admin actions (diamondCut)
      const testFacet = await viem.deployContract("OperableFacet", []);
      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const facetSelectors = getFunctionSelectors(testFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      // This should succeed, proving deployer is proxy admin
      await diamond.write.diamondCut(
        [
          [
            {
              target: testFacet.address,
              action: 0,
              selectors: facetSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: deployer.account,
        }
      );
    });

    it("should show that owner transfer does not affect proxy admin rights", async () => {
      // Transfer ownership to user1
      await diamond.write.transferOwnership([user1.account.address], {
        account: deployer.account,
      });

      // user1 accepts ownership
      await diamond.write.acceptOwnership({
        account: user1.account,
      });

      // Verify user1 is now the owner
      const newOwner = await diamond.read.owner();
      assert.strictEqual(
        newOwner.toLowerCase(),
        user1.account.address.toLowerCase(),
        "User1 should be the new owner"
      );

      // But deployer should still be able to perform diamond cuts (still proxy admin)
      const testFacet = await viem.deployContract("OperableFacet", []);
      const diamondAbi =
        require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const facetSelectors = getFunctionSelectors(testFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      await diamond.write.diamondCut(
        [
          [
            {
              target: testFacet.address,
              action: 0,
              selectors: facetSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: deployer.account,
        }
      );

      // And user1 (new owner) should NOT be able to perform diamond cuts
      const testFacet2 = await viem.deployContract("GameRegistryFacet", []);
      const facetSelectors2 = getFunctionSelectors(testFacet2.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

      try {
        await diamond.write.diamondCut(
          [
            [
              {
                target: testFacet2.address,
                action: 0,
                selectors: facetSelectors2,
              },
            ],
            "0x0000000000000000000000000000000000000000",
            "0x",
          ],
          {
            account: user1.account,
          }
        );
        assert.fail(
          "New owner should not be able to perform diamond cut without proxy admin rights"
        );
      } catch (error: any) {
        assert.ok(error.message.includes("Proxy__SenderIsNotAdmin"));
      }
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

