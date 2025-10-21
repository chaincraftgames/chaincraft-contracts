import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("GameRegistryFacet", () => {
  let diamond: any;
  let operableFacet: any;
  let gameRegistryFacet: any;
  let deployer: any;
  let operator: any;
  let user1: any;
  let user2: any;

  beforeEach(async () => {
    const { viem } = await network.connect();
    const walletClients = await viem.getWalletClients();
    [deployer, operator, user1, user2] = walletClients;

    // Deploy the Diamond contract
    diamond = await viem.deployContract("ChainCraftDiamond", []);

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

    // Get function selectors for OperableFacet
    const operableFacetSelectors = getFunctionSelectors(
      operableFacetContract.abi
    );

    // Get function selectors for GameRegistryFacet
    const gameRegistryFacetSelectors = getFunctionSelectors(
      gameRegistryFacetContract.abi
    );

    // Get selectors that are already added by the diamond (from SolidstateDiamondProxy)
    const diamondAbi =
      require("../artifacts/contracts/ChainCraftDiamond.sol/ChainCraftDiamond.json").abi;
    const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

    // Filter out selectors that are already added by the diamond
    const operableFacetSelectorsFiltered = operableFacetSelectors.filter(
      (selector) => !alreadyAddedSelectors.includes(selector)
    );

    const gameRegistryFacetSelectorsFiltered =
      gameRegistryFacetSelectors.filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );

    // Add both facets to diamond
    await diamond.write.diamondCut(
      [
        [
          {
            target: operableFacetContract.address,
            action: 0, // Add
            selectors: operableFacetSelectorsFiltered,
          },
          {
            target: gameRegistryFacetContract.address,
            action: 0, // Add
            selectors: gameRegistryFacetSelectorsFiltered,
          },
        ],
        "0x0000000000000000000000000000000000000000",
        "0x",
      ],
      {
        account: deployer.account,
      }
    );

    // Get the facet interfaces from the diamond
    operableFacet = await viem.getContractAt("OperableFacet", diamond.address);

    gameRegistryFacet = await viem.getContractAt(
      "GameRegistryFacet",
      diamond.address
    );

    // Initialize the GameRegistryFacet
    await gameRegistryFacet.write.initialize(["ChainCraft Games", "CCG"], {
      account: deployer.account,
    });

    // Add operator
    await operableFacet.write.addOperator([operator.account.address], {
      account: deployer.account,
    });
  });

  describe("Initialization", () => {
    it("should initialize with correct name and symbol", async () => {
      const name = await gameRegistryFacet.read.name();
      assert.strictEqual(name, "ChainCraft Games");

      const symbol = await gameRegistryFacet.read.symbol();
      assert.strictEqual(symbol, "CCG");
    });

    it("should not allow re-initialization", async () => {
      try {
        await gameRegistryFacet.write.initialize(["New Name", "NEW"], {
          account: deployer.account,
        });
        assert.fail("Should have failed - already initialized");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__AlreadyInitialized"));
      }
    });
  });

  describe("Operator Management", () => {
    it("should add operator", async () => {
      const isOperator = await operableFacet.read.isOperator([
        operator.account.address,
      ]);
      assert.strictEqual(isOperator, true);
    });

    it("should remove operator", async () => {
      await operableFacet.write.removeOperator([operator.account.address], {
        account: deployer.account,
      });

      const isOperator = await operableFacet.read.isOperator([
        operator.account.address,
      ]);
      assert.strictEqual(isOperator, false);
    });

    it("should get all operators", async () => {
      const operators = await operableFacet.read.getOperators();
      assert.strictEqual(operators.length, 1);
      assert.strictEqual(
        operators[0].toLowerCase(),
        operator.account.address.toLowerCase()
      );
    });

    it("should not allow non-owner to add operator", async () => {
      try {
        await operableFacet.write.addOperator([user1.account.address], {
          account: user1.account,
        });
        assert.fail("Should have failed - not owner");
      } catch (error: any) {
        assert.ok(error.message.includes("Ownable"));
      }
    });
  });

  describe("Game Publishing", () => {
    it("should publish a game as owner", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const gameURI = "ipfs://Qm.../game-metadata.json";

      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, gameURI],
        {
          account: deployer.account,
        }
      );

      // Verify game was published
      const totalGames = await gameRegistryFacet.read.totalGames();
      assert.strictEqual(totalGames, 1n);

      const retrievedTokenId = await gameRegistryFacet.read.getTokenIdByUUID([
        uuid,
      ]);
      assert.strictEqual(retrievedTokenId, 1n);

      const retrievedUUID = await gameRegistryFacet.read.getUUIDByTokenId([1n]);
      assert.strictEqual(retrievedUUID, uuid);

      const exists = await gameRegistryFacet.read.gameExists([uuid]);
      assert.strictEqual(exists, true);
    });

    it("should publish a game as operator", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440001";
      const gameURI = "ipfs://Qm.../game-metadata.json";

      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, gameURI],
        {
          account: operator.account,
        }
      );

      const totalGames = await gameRegistryFacet.read.totalGames();
      assert.strictEqual(totalGames, 1n);
    });

    it("should not allow non-owner/non-operator to publish game", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440002";
      const gameURI = "ipfs://Qm.../game-metadata.json";

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user1.account.address, gameURI],
          {
            account: user1.account,
          }
        );
        assert.fail("Should have failed - not authorized");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistryFacet__NotOperator"));
      }
    });

    it("should not allow publishing with empty UUID", async () => {
      const gameURI = "ipfs://Qm.../game-metadata.json";

      try {
        await gameRegistryFacet.write.publishGame(
          ["", user1.account.address, gameURI],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - empty UUID");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__EmptyUUID"));
      }
    });

    it("should not allow publishing with empty URI", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440003";

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user1.account.address, ""],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - empty URI");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__EmptyURI"));
      }
    });

    it("should not allow publishing with zero address", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440004";
      const gameURI = "ipfs://Qm.../game-metadata.json";

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, "0x0000000000000000000000000000000000000000", gameURI],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - invalid address");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__InvalidMintAddress"));
      }
    });

    it("should not allow publishing with duplicate UUID", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440005";
      const gameURI = "ipfs://Qm.../game-metadata.json";

      // First publish
      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, gameURI],
        {
          account: deployer.account,
        }
      );

      // Try to publish again with same UUID
      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user2.account.address, gameURI],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - duplicate UUID");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__GameAlreadyExists"));
      }
    });
  });

  describe("Game URI Updates", () => {
    let tokenId: bigint;
    let uuid: string;

    beforeEach(async () => {
      uuid = "550e8400-e29b-41d4-a716-446655440006";
      const gameURI = "ipfs://Qm.../game-metadata.json";

      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, gameURI],
        {
          account: deployer.account,
        }
      );
      tokenId = 1n;
    });

    it("should update game URI by token ID as token owner", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";

      await gameRegistryFacet.write.updateGameURI([tokenId, newURI], {
        account: user1.account,
      });

      const retrievedURI = await gameRegistryFacet.read.tokenURI([tokenId]);
      assert.strictEqual(retrievedURI, newURI);
    });

    it("should update game URI by UUID as token owner", async () => {
      const newURI = "ipfs://Qm.../updated-metadata-2.json";

      await gameRegistryFacet.write.updateGameURIByUUID([uuid, newURI], {
        account: user1.account,
      });

      const retrievedURI = await gameRegistryFacet.read.tokenURI([tokenId]);
      assert.strictEqual(retrievedURI, newURI);
    });

    it("should not allow non-owner to update game URI", async () => {
      const newURI = "ipfs://Qm.../updated-metadata-3.json";

      try {
        await gameRegistryFacet.write.updateGameURI([tokenId, newURI], {
          account: user2.account,
        });
        assert.fail("Should have failed - not token owner");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistryFacet__NotTokenOwner"));
      }
    });

    it("should not allow updating with empty URI", async () => {
      try {
        await gameRegistryFacet.write.updateGameURI([tokenId, ""], {
          account: user1.account,
        });
        assert.fail("Should have failed - empty URI");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__URICannotBeEmpty"));
      }
    });

    it("should not allow updating non-existent token", async () => {
      const newURI = "ipfs://Qm.../updated-metadata-4.json";

      try {
        await gameRegistryFacet.write.updateGameURI([999n, newURI], {
          account: user1.account,
        });
        assert.fail("Should have failed - token does not exist");
      } catch (error: any) {
        // The modifier checks token ownership first via _ownerOf(), which throws EnumerableMap__NonExistentKey
        // for non-existent tokens in the SolidState implementation
        const hasExpectedError =
          error.message.includes("GameRegistry__TokenDoesNotExist") ||
          error.message.includes("GameRegistryFacet__NotTokenOwner") ||
          error.message.includes("EnumerableMap__NonExistentKey") ||
          error.message.includes("ERC721");

        assert.ok(hasExpectedError, `Got unexpected error: ${error.message}`);
      }
    });
  });

  describe("View Functions", () => {
    let uuid1: string;
    let uuid2: string;

    beforeEach(async () => {
      uuid1 = "550e8400-e29b-41d4-a716-446655440007";
      uuid2 = "550e8400-e29b-41d4-a716-446655440008";

      await gameRegistryFacet.write.publishGame(
        [uuid1, user1.account.address, "ipfs://Qm.../game1.json"],
        {
          account: deployer.account,
        }
      );

      await gameRegistryFacet.write.publishGame(
        [uuid2, user2.account.address, "ipfs://Qm.../game2.json"],
        {
          account: deployer.account,
        }
      );
    });

    it("should return correct total games", async () => {
      const totalGames = await gameRegistryFacet.read.totalGames();
      assert.strictEqual(totalGames, 2n);
    });

    it("should return correct token ID for UUID", async () => {
      const tokenId1 = await gameRegistryFacet.read.getTokenIdByUUID([uuid1]);
      assert.strictEqual(tokenId1, 1n);

      const tokenId2 = await gameRegistryFacet.read.getTokenIdByUUID([uuid2]);
      assert.strictEqual(tokenId2, 2n);
    });

    it("should return correct UUID for token ID", async () => {
      const retrievedUUID1 = await gameRegistryFacet.read.getUUIDByTokenId([
        1n,
      ]);
      assert.strictEqual(retrievedUUID1, uuid1);

      const retrievedUUID2 = await gameRegistryFacet.read.getUUIDByTokenId([
        2n,
      ]);
      assert.strictEqual(retrievedUUID2, uuid2);
    });

    it("should return 0 for non-existent UUID", async () => {
      const tokenId = await gameRegistryFacet.read.getTokenIdByUUID([
        "non-existent-uuid",
      ]);
      assert.strictEqual(tokenId, 0n);
    });

    it("should return correct game existence", async () => {
      const exists1 = await gameRegistryFacet.read.gameExists([uuid1]);
      assert.strictEqual(exists1, true);

      const exists2 = await gameRegistryFacet.read.gameExists([
        "non-existent-uuid",
      ]);
      assert.strictEqual(exists2, false);
    });
  });

  describe("ERC721 Integration", () => {
    let tokenId: bigint;
    let uuid: string;

    beforeEach(async () => {
      uuid = "550e8400-e29b-41d4-a716-446655440009";
      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, "ipfs://Qm.../game.json"],
        {
          account: deployer.account,
        }
      );
      tokenId = 1n;
    });

    it("should have correct owner", async () => {
      const owner = await gameRegistryFacet.read.ownerOf([tokenId]);
      assert.strictEqual(
        owner.toLowerCase(),
        user1.account.address.toLowerCase()
      );
    });

    it("should transfer token", async () => {
      await gameRegistryFacet.write.transferFrom(
        [user1.account.address, user2.account.address, tokenId],
        {
          account: user1.account,
        }
      );

      const newOwner = await gameRegistryFacet.read.ownerOf([tokenId]);
      assert.strictEqual(
        newOwner.toLowerCase(),
        user2.account.address.toLowerCase()
      );
    });

    it("should return correct token URI", async () => {
      const uri = await gameRegistryFacet.read.tokenURI([tokenId]);
      assert.strictEqual(uri, "ipfs://Qm.../game.json");
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
