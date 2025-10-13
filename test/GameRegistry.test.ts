import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("GameRegistry", () => {
  let diamond: any;
  let gameRegistry: any;
  let deployer: any;
  let user1: any;
  let user2: any;

  beforeEach(async () => {
    const { viem } = await network.connect();
    const walletClients = await viem.getWalletClients();
    [deployer, user1, user2] = walletClients;

    // Deploy the Diamond contract
    diamond = await viem.deployContract("CCGRDiamond", []);

    // Deploy GameRegistryFacet
    const gameRegistryFacet = await viem.deployContract(
      "GameRegistryFacet",
      []
    );

    // Get function selectors for GameRegistryFacet
    const allSelectors = getFunctionSelectors(gameRegistryFacet.abi);

    // Get selectors that are already added by the diamond (from SolidstateDiamondProxy)
    const diamondAbi =
      require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
    const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

    // Filter out selectors that are already added by the diamond
    const selectors = allSelectors.filter(
      (selector) => !alreadyAddedSelectors.includes(selector)
    );

    // Add facet to diamond directly (now that ChainCraftDiamond inherits from DiamondProxyWritable)
    await diamond.write.diamondCut(
      [
        [
          {
            target: gameRegistryFacet.address,
            action: 0, // Add
            selectors: selectors,
          },
        ],
        "0x0000000000000000000000000000000000000000",
        "0x",
      ],
      {
        account: deployer.account,
      }
    );

    // Get the game registry interface from the diamond
    gameRegistry = await viem.getContractAt(
      "GameRegistryFacet",
      diamond.address
    );

    // Initialize the GameRegistry
    await gameRegistry.write.initialize(["ChainCraft Games", "CCG"], {
      account: deployer.account,
    });
  });

  describe("Initialization", () => {
    it("should initialize with correct name and symbol", async () => {
      const name = await gameRegistry.read.name();
      const symbol = await gameRegistry.read.symbol();

      assert.strictEqual(name, "ChainCraft Games");
      assert.strictEqual(symbol, "CCG");
    });

    it("should start with 0 total games", async () => {
      const totalGames = await gameRegistry.read.totalGames();
      assert.strictEqual(totalGames, 0n);
    });

    it("should not allow re-initialization", async () => {
      try {
        await gameRegistry.write.initialize(["New Name", "NEW"], {
          account: deployer.account,
        });
        assert.fail("Should have failed - already initialized");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__AlreadyInitialized"));
      }
    });
  });

  describe("Game Publishing", () => {
    it("should publish a game successfully", async () => {
      const gameURI = "https://example.com/game.json";

      await gameRegistry.write.publishGame([user1.account.address, gameURI], {
        account: deployer.account,
      });

      // Check token ownership
      const owner = await gameRegistry.read.ownerOf([1n]);
      assert.strictEqual(
        owner.toLowerCase(),
        user1.account.address.toLowerCase()
      );

      // Check token URI
      const tokenURI = await gameRegistry.read.tokenURI([1n]);
      assert.strictEqual(tokenURI, gameURI);

      // Check total games
      const totalGames = await gameRegistry.read.totalGames();
      assert.strictEqual(totalGames, 1n);
    });

    it("should not allow publishing to zero address", async () => {
      const gameURI = "https://example.com/game.json";

      try {
        await gameRegistry.write.publishGame(
          ["0x0000000000000000000000000000000000000000", gameURI],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - zero address");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__InvalidMintAddress"));
      }
    });

    it("should not allow publishing with empty URI", async () => {
      try {
        await gameRegistry.write.publishGame([user1.account.address, ""], {
          account: deployer.account,
        });
        assert.fail("Should have failed - empty URI");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__EmptyURI"));
      }
    });

    it("should not allow non-owner/operator to publish games", async () => {
      const gameURI = "https://example.com/game.json";

      try {
        await gameRegistry.write.publishGame([user1.account.address, gameURI], {
          account: user1.account,
        });
        assert.fail("Should have failed - not owner/operator");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__NotOperator"));
      }
    });

    it("should allow operator to publish games", async () => {
      // Add user1 as operator
      await gameRegistry.write.addOperator([user1.account.address], {
        account: deployer.account,
      });

      const gameURI = "https://example.com/game.json";

      await gameRegistry.write.publishGame([user2.account.address, gameURI], {
        account: user1.account,
      });

      const owner = await gameRegistry.read.ownerOf([1n]);
      assert.strictEqual(
        owner.toLowerCase(),
        user2.account.address.toLowerCase()
      );
    });
  });

  describe("Game URI Updates", () => {
    let tokenId: bigint;

    beforeEach(async () => {
      const gameURI = "https://example.com/game.json";

      await gameRegistry.write.publishGame([user1.account.address, gameURI], {
        account: deployer.account,
      });

      tokenId = 1n;
    });

    it("should allow token owner to update game URI", async () => {
      const newURI = "https://example.com/new-game.json";

      await gameRegistry.write.updateGameURI([tokenId, newURI], {
        account: user1.account,
      });

      // Check URI was updated
      const tokenURI = await gameRegistry.read.tokenURI([tokenId]);
      assert.strictEqual(tokenURI, newURI);
    });

    it("should not allow non-owner to update game URI", async () => {
      const newURI = "https://example.com/new-game.json";

      try {
        await gameRegistry.write.updateGameURI([tokenId, newURI], {
          account: user2.account,
        });
        assert.fail("Should have failed - not token owner");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__NotTokenOwner"));
      }
    });

    it("should not allow updating URI for non-existent token", async () => {
      const newURI = "https://example.com/new-game.json";

      try {
        await gameRegistry.write.updateGameURI([999n, newURI], {
          account: user1.account,
        });
        assert.fail("Should have failed - token doesn't exist");
      } catch (error: any) {
        assert.ok(error.message.includes("EnumerableMap__NonExistentKey"));
      }
    });

    it("should not allow empty URI", async () => {
      try {
        await gameRegistry.write.updateGameURI([tokenId, ""], {
          account: user1.account,
        });
        assert.fail("Should have failed - empty URI");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__URICannotBeEmpty"));
      }
    });
  });

  describe("ERC721 Functionality", () => {
    let tokenId: bigint;

    beforeEach(async () => {
      const gameURI = "https://example.com/game.json";

      await gameRegistry.write.publishGame([user1.account.address, gameURI], {
        account: deployer.account,
      });

      tokenId = 1n;
    });

    it("should support ERC721 interface", async () => {
      const supportsInterface = await gameRegistry.read.supportsInterface([
        "0x80ac58cd", // ERC721
      ]);
      assert.strictEqual(supportsInterface, true);
    });

    it("should return correct token URI", async () => {
      const gameURI = "https://example.com/game2.json";

      // Publish a new game with specific URI
      await gameRegistry.write.publishGame([user1.account.address, gameURI], {
        account: deployer.account,
      });

      const tokenURI = await gameRegistry.read.tokenURI([2n]);
      assert.strictEqual(tokenURI, gameURI);
    });

    it("should return correct owner of token", async () => {
      const owner = await gameRegistry.read.ownerOf([tokenId]);
      assert.strictEqual(
        owner.toLowerCase(),
        user1.account.address.toLowerCase()
      );
    });

    it("should return correct balance", async () => {
      const balance = await gameRegistry.read.balanceOf([
        user1.account.address,
      ]);
      assert.strictEqual(balance, 1n);

      // Publish another game to same user
      const gameURI = "https://example.com/game2.json";
      await gameRegistry.write.publishGame([user1.account.address, gameURI], {
        account: deployer.account,
      });

      const newBalance = await gameRegistry.read.balanceOf([
        user1.account.address,
      ]);
      assert.strictEqual(newBalance, 2n);
    });

    it("should allow token transfer", async () => {
      await gameRegistry.write.transferFrom(
        [user1.account.address, user2.account.address, tokenId],
        {
          account: user1.account,
        }
      );

      const newOwner = await gameRegistry.read.ownerOf([tokenId]);
      assert.strictEqual(
        newOwner.toLowerCase(),
        user2.account.address.toLowerCase()
      );
    });
  });

  describe("Operator Management", () => {
    it("should allow owner to add operator", async () => {
      await gameRegistry.write.addOperator([user1.account.address], {
        account: deployer.account,
      });

      // Check operator status
      const isOperator = await gameRegistry.read.isOperator([
        user1.account.address,
      ]);
      assert.strictEqual(isOperator, true);
    });

    it("should allow owner to remove operator", async () => {
      // First add operator
      await gameRegistry.write.addOperator([user1.account.address], {
        account: deployer.account,
      });

      // Then remove operator
      await gameRegistry.write.removeOperator([user1.account.address], {
        account: deployer.account,
      });

      // Check operator status
      const isOperator = await gameRegistry.read.isOperator([
        user1.account.address,
      ]);
      assert.strictEqual(isOperator, false);
    });

    it("should not allow non-owner to add operator", async () => {
      try {
        await gameRegistry.write.addOperator([user1.account.address], {
          account: user1.account,
        });
        assert.fail("Should have failed - not owner");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Ownable__NotOwner") ||
            error.message.includes("GameRegistry__NotOperator")
        );
      }
    });

    it("should return all operators", async () => {
      // Add multiple operators
      await gameRegistry.write.addOperator([user1.account.address], {
        account: deployer.account,
      });

      await gameRegistry.write.addOperator([user2.account.address], {
        account: deployer.account,
      });

      const operators = await gameRegistry.read.getOperators();
      assert.strictEqual(operators.length, 2);

      const operatorAddresses = operators.map((op: string) => op.toLowerCase());
      assert.ok(
        operatorAddresses.includes(user1.account.address.toLowerCase())
      );
      assert.ok(
        operatorAddresses.includes(user2.account.address.toLowerCase())
      );
    });
  });

  describe("Total Games Tracking", () => {
    it("should track total games correctly", async () => {
      let totalGames = await gameRegistry.read.totalGames();
      assert.strictEqual(totalGames, 0n);

      // Publish first game
      const gameURI1 = "https://example.com/game1.json";
      await gameRegistry.write.publishGame([user1.account.address, gameURI1], {
        account: deployer.account,
      });

      totalGames = await gameRegistry.read.totalGames();
      assert.strictEqual(totalGames, 1n);

      // Publish second game
      const gameURI2 = "https://example.com/game2.json";
      await gameRegistry.write.publishGame([user2.account.address, gameURI2], {
        account: deployer.account,
      });

      totalGames = await gameRegistry.read.totalGames();
      assert.strictEqual(totalGames, 2n);
    });

    it("should match totalSupply", async () => {
      const gameURI1 = "https://example.com/game1.json";
      await gameRegistry.write.publishGame([user1.account.address, gameURI1], {
        account: deployer.account,
      });

      const gameURI2 = "https://example.com/game2.json";
      await gameRegistry.write.publishGame([user2.account.address, gameURI2], {
        account: deployer.account,
      });

      const totalGames = await gameRegistry.read.totalGames();
      const totalSupply = await gameRegistry.read.totalSupply();

      assert.strictEqual(totalGames, totalSupply);
    });
  });
});

/**
 * Get function selectors from ABI (like in your example)
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
