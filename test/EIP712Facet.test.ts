import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import {
  toFunctionSelector,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  pad,
} from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("EIP712Facet", () => {
  let diamond: any;
  let eip712Facet: any;
  let gameRegistryFacet: any;
  let operableFacet: any;
  let deployer: any;
  let operator: any;
  let user: any;
  let attacker: any;
  let viem: any;
  let publicClient: any;

  beforeEach(async () => {
    const network_result = await network.connect();
    viem = network_result.viem;
    publicClient = viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    [deployer, operator, user, attacker] = walletClients;

    // Deploy the Diamond contract
    diamond = await viem.deployContract("ChainCraftDiamond", [], {
      account: deployer.account,
    });

    // Deploy EIP712Facet
    const eip712FacetContract = await viem.deployContract("EIP712Facet", []);

    // Deploy OperableFacet
    const operableFacetContract = await viem.deployContract(
      "OperableFacet",
      []
    );

    // Deploy GameRegistryFacet
    const gameRegistryFacetContract = await viem.deployContract(
      "GameRegistryFacet",
      []
    );

    // Get function selectors
    const diamondAbi =
      require("../artifacts/contracts/ChainCraftDiamond.sol/ChainCraftDiamond.json").abi;
    const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

    const eip712Selectors = getFunctionSelectors(
      eip712FacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    const operableSelectors = getFunctionSelectors(
      operableFacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    const gameRegistrySelectors = getFunctionSelectors(
      gameRegistryFacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    // Add all facets to diamond
    await diamond.write.diamondCut(
      [
        [
          {
            target: eip712FacetContract.address,
            action: 0, // Add
            selectors: eip712Selectors,
          },
          {
            target: operableFacetContract.address,
            action: 0, // Add
            selectors: operableSelectors,
          },
          {
            target: gameRegistryFacetContract.address,
            action: 0, // Add
            selectors: gameRegistrySelectors,
          },
        ],
        "0x0000000000000000000000000000000000000000",
        "0x",
      ],
      {
        account: deployer.account,
      }
    );

    // Get facet interfaces from the diamond
    eip712Facet = await viem.getContractAt("EIP712Facet", diamond.address);

    operableFacet = await viem.getContractAt("OperableFacet", diamond.address);

    gameRegistryFacet = await viem.getContractAt(
      "GameRegistryFacet",
      diamond.address
    );

    // Initialize GameRegistry
    await gameRegistryFacet.write.initialize(["ChainCraft Games", "CCG"], {
      account: deployer.account,
    });

    // Add operator
    await operableFacet.write.addOperator([operator.account.address], {
      account: deployer.account,
    });
  });

  describe("Domain Separator", () => {
    it("should return a valid domain separator", async () => {
      const domainSeparator = await eip712Facet.read.DOMAIN_SEPARATOR();

      // Domain separator should be a non-zero bytes32 value
      assert.notStrictEqual(
        domainSeparator,
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );

      // Verify it's a valid bytes32 (66 characters including 0x)
      assert.strictEqual(domainSeparator.length, 66);
      assert.ok(domainSeparator.startsWith("0x"));
    });

    it("should return consistent domain separator across calls", async () => {
      const domainSeparator1 = await eip712Facet.read.DOMAIN_SEPARATOR();
      const domainSeparator2 = await eip712Facet.read.DOMAIN_SEPARATOR();

      assert.strictEqual(domainSeparator1, domainSeparator2);
    });
  });

  describe("Signature Tracking", () => {
    it("should initially show signature as not used", async () => {
      const testDigest =
        "0x1234567890123456789012345678901234567890123456789012345678901234";
      const isUsed = await eip712Facet.read.isSignatureUsed([testDigest]);

      assert.strictEqual(isUsed, false);
    });
  });

  describe("EIP712 Signature Verification with Game Publishing", () => {
    it("should publish game with valid EIP-712 signature from user", async () => {
      const uuid = "test-game-uuid-1";
      const gameURI = "ipfs://Qm123abc";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

      // Use signTypedData for proper EIP-712 signing
      // Hardhat default chainId is 31337
      const chainIdNumber = 31337;
      const signature = await user.signTypedData({
        domain: {
          name: "ChainCraft",
          version: "1",
          chainId: chainIdNumber,
          verifyingContract: diamond.address as `0x${string}`,
        },
        types: {
          PublishGame: [
            { name: "uuid", type: "string" },
            { name: "to", type: "address" },
            { name: "gameURI", type: "string" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "PublishGame",
        message: {
          uuid,
          to: user.account.address,
          gameURI,
          deadline,
        },
      });

      // Operator publishes the game with user's signature
      const tx = await gameRegistryFacet.write.publishGame(
        [uuid, user.account.address, gameURI, deadline, signature],
        {
          account: operator.account,
        }
      );

      // Verify the game was minted
      const tokenId = await gameRegistryFacet.read.getTokenIdByUUID([uuid]);
      assert.ok(tokenId > 0n, "Game should be minted");

      // Verify owner is the user
      const owner = await gameRegistryFacet.read.ownerOf([tokenId]);
      assert.strictEqual(
        owner.toLowerCase(),
        user.account.address.toLowerCase()
      );
    });

    it("should reject game publishing with signature from wrong signer", async () => {
      const uuid = "test-game-uuid-2";
      const gameURI = "ipfs://Qm456def";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Attacker signs instead of user - this should fail
      const chainIdNumber = 31337;
      const signature = await attacker.signTypedData({
        domain: {
          name: "ChainCraft",
          version: "1",
          chainId: chainIdNumber,
          verifyingContract: diamond.address as `0x${string}`,
        },
        types: {
          PublishGame: [
            { name: "uuid", type: "string" },
            { name: "to", type: "address" },
            { name: "gameURI", type: "string" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "PublishGame",
        message: {
          uuid,
          to: user.account.address,
          gameURI,
          deadline,
        },
      });

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user.account.address, gameURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have rejected signature from wrong signer");
      } catch (error: any) {
        assert.ok(
          error.message.includes("GameRegistry__SignerMismatch"),
          `Expected SignerMismatch error, got: ${error.message}`
        );
      }
    });

    it("should reject expired signature", async () => {
      const uuid = "test-game-uuid-3";
      const gameURI = "ipfs://Qm789ghi";
      const deadline = BigInt(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago (expired)

      const chainIdNumber = 31337;
      const signature = await user.signTypedData({
        domain: {
          name: "ChainCraft",
          version: "1",
          chainId: chainIdNumber,
          verifyingContract: diamond.address as `0x${string}`,
        },
        types: {
          PublishGame: [
            { name: "uuid", type: "string" },
            { name: "to", type: "address" },
            { name: "gameURI", type: "string" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "PublishGame",
        message: {
          uuid,
          to: user.account.address,
          gameURI,
          deadline,
        },
      });

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user.account.address, gameURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have rejected expired signature");
      } catch (error: any) {
        assert.ok(
          error.message.includes("EIP712__SignatureExpired"),
          `Expected SignatureExpired error, got: ${error.message}`
        );
      }
    });

    it("should prevent signature replay attacks", async () => {
      const uuid = "test-game-uuid-4";
      const gameURI = "ipfs://Qmabc123";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const chainIdNumber = 31337;
      const signature = await user.signTypedData({
        domain: {
          name: "ChainCraft",
          version: "1",
          chainId: chainIdNumber,
          verifyingContract: diamond.address as `0x${string}`,
        },
        types: {
          PublishGame: [
            { name: "uuid", type: "string" },
            { name: "to", type: "address" },
            { name: "gameURI", type: "string" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "PublishGame",
        message: {
          uuid,
          to: user.account.address,
          gameURI,
          deadline,
        },
      });

      // First use should succeed
      await gameRegistryFacet.write.publishGame(
        [uuid, user.account.address, gameURI, deadline, signature],
        {
          account: operator.account,
        }
      );

      // Try to replay the same signature with same parameters (should fail)
      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user.account.address, gameURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have prevented signature replay");
      } catch (error: any) {
        assert.ok(
          error.message.includes("EIP712__SignatureAlreadyUsed") ||
            error.message.includes("GameRegistry__GameAlreadyExists"),
          `Expected SignatureAlreadyUsed or GameAlreadyExists error, got: ${error.message}`
        );
      }
    });

    it("should correctly recover signer address", async () => {
      // Use a proper PublishGame struct hash for testing
      const uuid = "test-recover-uuid";
      const gameURI = "ipfs://Qmtest";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Compute struct hash for the contract's recoverSigner function
      const PUBLISH_GAME_TYPEHASH = keccak256(
        Buffer.from(
          "PublishGame(string uuid,address to,string gameURI,uint256 deadline)"
        )
      );

      const structHash = keccak256(
        encodeAbiParameters(
          parseAbiParameters("bytes32, bytes32, address, bytes32, uint256"),
          [
            PUBLISH_GAME_TYPEHASH,
            keccak256(Buffer.from(uuid)),
            user.account.address,
            keccak256(Buffer.from(gameURI)),
            deadline,
          ]
        )
      );

      const chainIdNumber = 31337;
      const signature = await user.signTypedData({
        domain: {
          name: "ChainCraft",
          version: "1",
          chainId: chainIdNumber,
          verifyingContract: diamond.address as `0x${string}`,
        },
        types: {
          PublishGame: [
            { name: "uuid", type: "string" },
            { name: "to", type: "address" },
            { name: "gameURI", type: "string" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "PublishGame",
        message: {
          uuid,
          to: user.account.address,
          gameURI,
          deadline,
        },
      });

      const recoveredSigner = await eip712Facet.read.recoverSigner([
        structHash,
        signature,
      ]);

      assert.strictEqual(
        recoveredSigner.toLowerCase(),
        user.account.address.toLowerCase(),
        "Should correctly recover the signer address"
      );
    });
  });
});

// Helper function to get function selectors from ABI
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
