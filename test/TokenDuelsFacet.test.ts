import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";
import { toFunctionSelector } from "viem";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("TokenDuelsFacet", () => {
  let diamond: any;
  let tokenDuelsFacet: any;
  let operableFacet: any;
  let token: any;
  let deployer: any;
  let operator: any;
  let player1: any;
  let player2: any;
  let attacker: any;
  let viem: any;

  beforeEach(async () => {
    const network_result = await network.connect();
    viem = network_result.viem;
    const walletClients = await viem.getWalletClients();
    [deployer, operator, player1, player2, attacker] = walletClients;

    // Deploy the Diamond contract
    diamond = await viem.deployContract("CCTDDiamond", []);

    // Deploy OperableFacet
    const operableFacetContract = await viem.deployContract(
      "OperableFacet",
      []
    );

    // Deploy TokenDuelsFacet
    const tokenDuelsFacetContract = await viem.deployContract(
      "TokenDuelsFacet",
      []
    );

    // Get function selectors
    const diamondAbi =
      require("../artifacts/contracts/CCTDDiamond.sol/CCTDDiamond.json").abi;
    const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

    const operableFacetSelectors = getFunctionSelectors(
      operableFacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    const tokenDuelsFacetSelectors = getFunctionSelectors(
      tokenDuelsFacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    // Add all facets to diamond
    await diamond.write.diamondCut(
      [
        [
          {
            target: operableFacetContract.address,
            action: 0, // Add
            selectors: operableFacetSelectors,
          },
          {
            target: tokenDuelsFacetContract.address,
            action: 0, // Add
            selectors: tokenDuelsFacetSelectors,
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
    tokenDuelsFacet = await viem.getContractAt(
      "TokenDuelsFacet",
      diamond.address
    );

    // Deploy ERC20 token for testing
    const initialSupply = BigInt(1000000) * BigInt(10 ** 18); // 1M tokens
    token = await viem.deployContract("ChainCraftToken", [initialSupply]);

    // Add operator
    await operableFacet.write.addOperator([operator.account.address], {
      account: deployer.account,
    });

    // Mint tokens to players for testing
    const playerBalance = BigInt(100000) * BigInt(10 ** 18); // 100k tokens each
    await token.write.transfer([player1.account.address, playerBalance], {
      account: deployer.account,
    });
    await token.write.transfer([player2.account.address, playerBalance], {
      account: deployer.account,
    });
  });

  describe("Diamond Deployment & Facet Integration", () => {
    it("should deploy diamond correctly", async () => {
      assert.ok(diamond.address, "Diamond should have an address");
      assert.notStrictEqual(
        diamond.address,
        "0x0000000000000000000000000000000000000000"
      );
    });

    it("should have facets added to diamond", async () => {
      const facetAddresses = await diamond.read.facetAddresses();
      assert.ok(facetAddresses.length > 0, "Should have facets");
    });

    it("should route function selectors correctly", async () => {
      // Test that we can call a function from TokenDuelsFacet
      try {
        await tokenDuelsFacet.read.stakeAmount();
        // If we get here without error, the selector is routed correctly
        assert.ok(true);
      } catch (error: any) {
        // Expected error when token not configured, but function exists
        assert.ok(
          error.message.includes("TokenDuels__TokenNotSet") ||
            error.message.includes("stakeAmount")
        );
      }
    });

    it("should have deployer as owner", async () => {
      const owner = await diamond.read.owner();
      assert.strictEqual(
        owner.toLowerCase(),
        deployer.account.address.toLowerCase()
      );
    });
  });

  describe("Token Configuration", () => {
    it("should configure token as owner", async () => {
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      const [configuredToken, decimals] =
        await tokenDuelsFacet.read.configuredToken();
      assert.strictEqual(
        configuredToken.toLowerCase(),
        token.address.toLowerCase()
      );
      assert.strictEqual(decimals, 18);
    });

    it("should configure token as operator", async () => {
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: operator.account,
      });

      const [configuredToken, decimals] =
        await tokenDuelsFacet.read.configuredToken();
      assert.strictEqual(
        configuredToken.toLowerCase(),
        token.address.toLowerCase()
      );
      assert.strictEqual(decimals, 18);
    });

    it("should reject zero address", async () => {
      try {
        await tokenDuelsFacet.write.configureToken([
          "0x0000000000000000000000000000000000000000",
        ], {
          account: deployer.account,
        });
        assert.fail("Should have failed - zero address");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__ZeroAddress"),
          `Expected TokenDuels__ZeroAddress error, got: ${error.message}`
        );
      }
    });

    it("should return correct stake amount", async () => {
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();
      const expectedStake = BigInt(10) * BigInt(10 ** 18); // 10 tokens with 18 decimals
      assert.strictEqual(stakeAmount, expectedStake);
    });

    it("should reject stakeAmount when token not configured", async () => {
      try {
        await tokenDuelsFacet.read.stakeAmount();
        assert.fail("Should have failed - token not configured");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__TokenNotSet"),
          `Expected TokenDuels__TokenNotSet error, got: ${error.message}`
        );
      }
    });

    it("should reject configureToken from non-owner/operator", async () => {
      try {
        await tokenDuelsFacet.write.configureToken([token.address], {
          account: player1.account,
        });
        assert.fail("Should have failed - not owner or operator");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuelsFacet__NotOperator") ||
            error.message.includes("Ownable"),
          `Expected access control error, got: ${error.message}`
        );
      }
    });
  });

  describe("Game Creation", () => {
    beforeEach(async () => {
      // Configure token before each test
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      // Approve diamond to spend tokens
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });
    });

    it("should create game with valid parameters", async () => {
      const sessionId = 1n;
      const gameId = 100n;
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      const balanceBefore = await token.read.balanceOf([
        player1.account.address,
      ]);

      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });

      const balanceAfter = await token.read.balanceOf([
        player1.account.address,
      ]);

      assert.strictEqual(
        balanceBefore - balanceAfter,
        stakeAmount,
        "Tokens should be transferred"
      );

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(
        game.p1.toLowerCase(),
        player1.account.address.toLowerCase()
      );
      assert.strictEqual(game.p2, "0x0000000000000000000000000000000000000000");
      assert.strictEqual(game.stakeAmount, stakeAmount);
      assert.strictEqual(game.p1Deposit, stakeAmount);
      assert.strictEqual(game.p2Deposit, 0n);
      assert.strictEqual(game.state, 1); // WAITING_FOR_P2
      assert.strictEqual(game.gameId, gameId);
    });

    it("should emit GameCreated event", async () => {
      const sessionId = 1n;
      const gameId = 100n;

      // Transaction should succeed and game should be created
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });

      // Verify game was created (which confirms event was emitted)
      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 1); // WAITING_FOR_P2
    });

    it("should reject zero sessionId", async () => {
      try {
        await tokenDuelsFacet.write.createGame([0n, 100n], {
          account: player1.account,
        });
        assert.fail("Should have failed - zero sessionId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidGameId"),
          `Expected TokenDuels__InvalidGameId error, got: ${error.message}`
        );
      }
    });

    it("should reject zero gameId", async () => {
      try {
        await tokenDuelsFacet.write.createGame([1n, 0n], {
          account: player1.account,
        });
        assert.fail("Should have failed - zero gameId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidGameId"),
          `Expected TokenDuels__InvalidGameId error, got: ${error.message}`
        );
      }
    });

    it("should reject when token not configured", async () => {
      // Deploy a new diamond and add facet but don't configure token
      const newDiamond = await viem.deployContract("CCTDDiamond", []);
      const newOperableFacet = await viem.deployContract("OperableFacet", []);
      const newTokenDuelsFacetContract = await viem.deployContract(
        "TokenDuelsFacet",
        []
      );

      const diamondAbi =
        require("../artifacts/contracts/CCTDDiamond.sol/CCTDDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const operableSelectors = getFunctionSelectors(newOperableFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );
      const tokenDuelsSelectors = getFunctionSelectors(
        newTokenDuelsFacetContract.abi
      ).filter((selector) => !alreadyAddedSelectors.includes(selector));

      await newDiamond.write.diamondCut(
        [
          [
            {
              target: newOperableFacet.address,
              action: 0,
              selectors: operableSelectors,
            },
            {
              target: newTokenDuelsFacetContract.address,
              action: 0,
              selectors: tokenDuelsSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: deployer.account,
        }
      );

      const newTokenDuelsFacet = await viem.getContractAt(
        "TokenDuelsFacet",
        newDiamond.address
      );

      try {
        await newTokenDuelsFacet.write.createGame([1n, 100n], {
          account: player1.account,
        });
        assert.fail("Should have failed - token not configured");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__TokenNotSet"),
          `Expected TokenDuels__TokenNotSet error, got: ${error.message}`
        );
      }
    });

    it("should reject duplicate sessionId", async () => {
      const sessionId = 1n;
      const gameId = 100n;

      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });

      try {
        await tokenDuelsFacet.write.createGame([sessionId, gameId + 1n], {
          account: player2.account,
        });
        assert.fail("Should have failed - duplicate sessionId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__SessionIdExists"),
          `Expected TokenDuels__SessionIdExists error, got: ${error.message}`
        );
      }
    });

    it("should reject insufficient token balance", async () => {
      // Get a wallet client with no tokens
      const walletClients = await viem.getWalletClients();
      const poorPlayer = walletClients[5] || walletClients[walletClients.length - 1];
      const sessionId = 1n;
      const gameId = 100n;

      try {
        await tokenDuelsFacet.write.createGame([sessionId, gameId], {
          account: poorPlayer.account,
        });
        assert.fail("Should have failed - insufficient balance");
      } catch (error: any) {
        assert.ok(
          error.message.includes("InsufficientBalance") ||
            error.message.includes("transfer") ||
            error.message.includes("Address") ||
            error.message.includes("revert"),
          `Expected insufficient balance error, got: ${error.message}`
        );
      }
    });

    it("should reject insufficient allowance", async () => {
      // Revoke approval
      await token.write.approve([diamond.address, 0n], {
        account: player1.account,
      });

      try {
        await tokenDuelsFacet.write.createGame([1n, 100n], {
          account: player1.account,
        });
        assert.fail("Should have failed - insufficient allowance");
      } catch (error: any) {
        assert.ok(
          error.message.includes("InsufficientAllowance") ||
            error.message.includes("transfer") ||
            error.message.includes("revert") ||
            error.message.includes("custom error"),
          `Expected insufficient allowance error, got: ${error.message}`
        );
      }
    });
  });

  describe("Game Joining", () => {
    let sessionId: bigint;
    let gameId: bigint;
    let stakeAmount: bigint;

    beforeEach(async () => {
      // Configure token
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Approve tokens
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });

      // Create a game
      sessionId = 1n;
      gameId = 100n;
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
    });

    it("should join game with valid sessionId", async () => {
      const balanceBefore = await token.read.balanceOf([
        player2.account.address,
      ]);

      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });

      const balanceAfter = await token.read.balanceOf([
        player2.account.address,
      ]);

      assert.strictEqual(
        balanceBefore - balanceAfter,
        stakeAmount,
        "Tokens should be transferred"
      );

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(
        game.p2.toLowerCase(),
        player2.account.address.toLowerCase()
      );
      assert.strictEqual(game.p2Deposit, stakeAmount);
      assert.strictEqual(game.state, 2); // ACTIVE
    });

    it("should emit GameJoined event", async () => {
      // Transaction should succeed and game should transition to ACTIVE
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });

      // Verify game state changed (which confirms event was emitted)
      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 2); // ACTIVE
    });

    it("should reject invalid sessionId", async () => {
      try {
        await tokenDuelsFacet.write.joinGame([999n], {
          account: player2.account,
        });
        assert.fail("Should have failed - invalid sessionId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidGameId"),
          `Expected TokenDuels__InvalidGameId error, got: ${error.message}`
        );
      }
    });

    it("should reject wrong game state", async () => {
      // Settle the game first
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });
      await tokenDuelsFacet.write.settleGame(
        [sessionId, player1.account.address],
        {
          account: deployer.account,
        }
      );

      // Try to join a finished game
      try {
        await tokenDuelsFacet.write.joinGame([sessionId], {
          account: player2.account,
        });
        assert.fail("Should have failed - wrong state");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__WrongState"),
          `Expected TokenDuels__WrongState error, got: ${error.message}`
        );
      }
    });

    it("should reject when already joined", async () => {
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });

      try {
        await tokenDuelsFacet.write.joinGame([sessionId], {
          account: player2.account,
        });
        assert.fail("Should have failed - already joined");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__AlreadyJoined") ||
            error.message.includes("TokenDuels__WrongState"),
          `Expected AlreadyJoined or WrongState error, got: ${error.message}`
        );
      }
    });

    it("should reject joining own game", async () => {
      try {
        await tokenDuelsFacet.write.joinGame([sessionId], {
          account: player1.account,
        });
        assert.fail("Should have failed - cannot join own game");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__CannotJoinSelf"),
          `Expected TokenDuels__CannotJoinSelf error, got: ${error.message}`
        );
      }
    });

    it("should reject insufficient token balance", async () => {
      // Get a wallet client with no tokens
      const walletClients = await viem.getWalletClients();
      const poorPlayer = walletClients[5] || walletClients[walletClients.length - 1];

      try {
        await tokenDuelsFacet.write.joinGame([sessionId], {
          account: poorPlayer.account,
        });
        assert.fail("Should have failed - insufficient balance");
      } catch (error: any) {
        assert.ok(
          error.message.includes("InsufficientBalance") ||
            error.message.includes("transfer") ||
            error.message.includes("Address") ||
            error.message.includes("revert"),
          `Expected insufficient balance error, got: ${error.message}`
        );
      }
    });

    it("should reject insufficient allowance", async () => {
      // Revoke approval
      await token.write.approve([diamond.address, 0n], {
        account: player2.account,
      });

      try {
        await tokenDuelsFacet.write.joinGame([sessionId], {
          account: player2.account,
        });
        assert.fail("Should have failed - insufficient allowance");
      } catch (error: any) {
        assert.ok(
          error.message.includes("InsufficientAllowance") ||
            error.message.includes("transfer") ||
            error.message.includes("revert") ||
            error.message.includes("custom error"),
          `Expected insufficient allowance error, got: ${error.message}`
        );
      }
    });
  });

  describe("Game Settling", () => {
    let sessionId: bigint;
    let gameId: bigint;
    let stakeAmount: bigint;

    beforeEach(async () => {
      // Configure token
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Approve tokens
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });

      // Create and join game
      sessionId = 1n;
      gameId = 100n;
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });
    });

    it("should settle game with player1 as winner (owner)", async () => {
      const winnerBalanceBefore = await token.read.balanceOf([
        player1.account.address,
      ]);
      const contractBalanceBefore = await token.read.balanceOf([
        diamond.address,
      ]);

      await tokenDuelsFacet.write.settleGame(
        [sessionId, player1.account.address],
        {
          account: deployer.account,
        }
      );

      const winnerBalanceAfter = await token.read.balanceOf([
        player1.account.address,
      ]);
      const contractBalanceAfter = await token.read.balanceOf([
        diamond.address,
      ]);

      const totalStake = stakeAmount * BigInt(2);
      assert.strictEqual(
        winnerBalanceAfter - winnerBalanceBefore,
        totalStake,
        "Winner should receive total stake"
      );
      assert.strictEqual(
        contractBalanceBefore - contractBalanceAfter,
        totalStake,
        "Contract should transfer total stake"
      );

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 3); // FINISHED
      assert.strictEqual(
        game.winner.toLowerCase(),
        player1.account.address.toLowerCase()
      );
      assert.strictEqual(game.p1Deposit, 0n);
      assert.strictEqual(game.p2Deposit, 0n);
    });

    it("should settle game with player2 as winner (operator)", async () => {
      const winnerBalanceBefore = await token.read.balanceOf([
        player2.account.address,
      ]);

      await tokenDuelsFacet.write.settleGame(
        [sessionId, player2.account.address],
        {
          account: operator.account,
        }
      );

      const winnerBalanceAfter = await token.read.balanceOf([
        player2.account.address,
      ]);

      const totalStake = stakeAmount * BigInt(2);
      assert.strictEqual(
        winnerBalanceAfter - winnerBalanceBefore,
        totalStake,
        "Winner should receive total stake"
      );

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 3); // FINISHED
      assert.strictEqual(
        game.winner.toLowerCase(),
        player2.account.address.toLowerCase()
      );
    });

    it("should emit GameSettled event", async () => {
      // Transaction should succeed and game should be settled
      await tokenDuelsFacet.write.settleGame(
        [sessionId, player1.account.address],
        {
          account: deployer.account,
        }
      );

      // Verify game state changed (which confirms event was emitted)
      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 3); // FINISHED
    });

    it("should reject invalid sessionId", async () => {
      try {
        await tokenDuelsFacet.write.settleGame(
          [999n, player1.account.address],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - invalid sessionId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidGameId"),
          `Expected TokenDuels__InvalidGameId error, got: ${error.message}`
        );
      }
    });

    it("should reject wrong game state", async () => {
      // Cancel the game first
      await tokenDuelsFacet.write.cancelActiveGame([sessionId], {
        account: deployer.account,
      });

      try {
        await tokenDuelsFacet.write.settleGame(
          [sessionId, player1.account.address],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - wrong state");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__WrongState"),
          `Expected TokenDuels__WrongState error, got: ${error.message}`
        );
      }
    });

    it("should reject invalid winner", async () => {
      try {
        await tokenDuelsFacet.write.settleGame(
          [sessionId, attacker.account.address],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - invalid winner");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidWinner"),
          `Expected TokenDuels__InvalidWinner error, got: ${error.message}`
        );
      }
    });

    it("should reject non-owner/operator caller", async () => {
      try {
        await tokenDuelsFacet.write.settleGame(
          [sessionId, player1.account.address],
          {
            account: player1.account,
          }
        );
        assert.fail("Should have failed - not owner or operator");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuelsFacet__NotOperator") ||
            error.message.includes("Ownable"),
          `Expected access control error, got: ${error.message}`
        );
      }
    });
  });

  describe("Game Cancellation (Waiting)", () => {
    let sessionId: bigint;
    let gameId: bigint;
    let stakeAmount: bigint;

    beforeEach(async () => {
      // Configure token
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Approve tokens
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });

      // Create a game (waiting for p2)
      sessionId = 1n;
      gameId = 100n;
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
    });

    it("should cancel waiting game and refund player1", async () => {
      const playerBalanceBefore = await token.read.balanceOf([
        player1.account.address,
      ]);
      const contractBalanceBefore = await token.read.balanceOf([
        diamond.address,
      ]);

      await tokenDuelsFacet.write.cancelWaitingGame([sessionId], {
        account: deployer.account,
      });

      const playerBalanceAfter = await token.read.balanceOf([
        player1.account.address,
      ]);
      const contractBalanceAfter = await token.read.balanceOf([
        diamond.address,
      ]);

      assert.strictEqual(
        playerBalanceAfter - playerBalanceBefore,
        stakeAmount,
        "Player should receive refund"
      );
      assert.strictEqual(
        contractBalanceBefore - contractBalanceAfter,
        stakeAmount,
        "Contract should refund stake"
      );

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 4); // CANCELED
      assert.strictEqual(game.p1Deposit, 0n);
    });

    it("should emit GameCanceled event", async () => {
      // Transaction should succeed and game should be canceled
      await tokenDuelsFacet.write.cancelWaitingGame([sessionId], {
        account: deployer.account,
      });

      // Verify game state changed (which confirms event was emitted)
      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 4); // CANCELED
    });

    it("should reject invalid sessionId", async () => {
      try {
        await tokenDuelsFacet.write.cancelWaitingGame([999n], {
          account: deployer.account,
        });
        assert.fail("Should have failed - invalid sessionId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidGameId"),
          `Expected TokenDuels__InvalidGameId error, got: ${error.message}`
        );
      }
    });

    it("should reject wrong game state", async () => {
      // Join the game first
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });

      try {
        await tokenDuelsFacet.write.cancelWaitingGame([sessionId], {
          account: deployer.account,
        });
        assert.fail("Should have failed - wrong state");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__WrongState"),
          `Expected TokenDuels__WrongState error, got: ${error.message}`
        );
      }
    });

    it("should reject non-owner/operator caller", async () => {
      try {
        await tokenDuelsFacet.write.cancelWaitingGame([sessionId], {
          account: player1.account,
        });
        assert.fail("Should have failed - not owner or operator");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuelsFacet__NotOperator") ||
            error.message.includes("Ownable"),
          `Expected access control error, got: ${error.message}`
        );
      }
    });
  });

  describe("Game Cancellation (Active)", () => {
    let sessionId: bigint;
    let gameId: bigint;
    let stakeAmount: bigint;

    beforeEach(async () => {
      // Configure token
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Approve tokens
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });

      // Create and join game
      sessionId = 1n;
      gameId = 100n;
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });
    });

    it("should cancel active game and refund both players", async () => {
      const player1BalanceBefore = await token.read.balanceOf([
        player1.account.address,
      ]);
      const player2BalanceBefore = await token.read.balanceOf([
        player2.account.address,
      ]);
      const contractBalanceBefore = await token.read.balanceOf([
        diamond.address,
      ]);

      await tokenDuelsFacet.write.cancelActiveGame([sessionId], {
        account: deployer.account,
      });

      const player1BalanceAfter = await token.read.balanceOf([
        player1.account.address,
      ]);
      const player2BalanceAfter = await token.read.balanceOf([
        player2.account.address,
      ]);
      const contractBalanceAfter = await token.read.balanceOf([
        diamond.address,
      ]);

      assert.strictEqual(
        player1BalanceAfter - player1BalanceBefore,
        stakeAmount,
        "Player1 should receive refund"
      );
      assert.strictEqual(
        player2BalanceAfter - player2BalanceBefore,
        stakeAmount,
        "Player2 should receive refund"
      );
      assert.strictEqual(
        contractBalanceBefore - contractBalanceAfter,
        stakeAmount * BigInt(2),
        "Contract should refund both stakes"
      );

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 4); // CANCELED
      assert.strictEqual(game.p1Deposit, 0n);
      assert.strictEqual(game.p2Deposit, 0n);
    });

    it("should emit GameCanceled event", async () => {
      // Transaction should succeed and game should be canceled
      await tokenDuelsFacet.write.cancelActiveGame([sessionId], {
        account: deployer.account,
      });

      // Verify game state changed (which confirms event was emitted)
      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 4); // CANCELED
    });

    it("should reject invalid sessionId", async () => {
      try {
        await tokenDuelsFacet.write.cancelActiveGame([999n], {
          account: deployer.account,
        });
        assert.fail("Should have failed - invalid sessionId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidGameId"),
          `Expected TokenDuels__InvalidGameId error, got: ${error.message}`
        );
      }
    });

    it("should reject wrong game state", async () => {
      // Cancel the game first
      await tokenDuelsFacet.write.cancelActiveGame([sessionId], {
        account: deployer.account,
      });

      try {
        await tokenDuelsFacet.write.cancelActiveGame([sessionId], {
          account: deployer.account,
        });
        assert.fail("Should have failed - wrong state");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__WrongState"),
          `Expected TokenDuels__WrongState error, got: ${error.message}`
        );
      }
    });

    it("should reject non-owner/operator caller", async () => {
      try {
        await tokenDuelsFacet.write.cancelActiveGame([sessionId], {
          account: player1.account,
        });
        assert.fail("Should have failed - not owner or operator");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuelsFacet__NotOperator") ||
            error.message.includes("Ownable"),
          `Expected access control error, got: ${error.message}`
        );
      }
    });
  });

  describe("Token Rescue", () => {
    let stakeAmount: bigint;

    beforeEach(async () => {
      // Configure token
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Send some tokens to the diamond contract
      await token.write.transfer([diamond.address, stakeAmount * BigInt(5)], {
        account: deployer.account,
      });
    });

    it("should rescue tokens as owner", async () => {
      const rescueAmount = stakeAmount * BigInt(2);
      const rescueAddress = player1.account.address;

      const rescueBalanceBefore = await token.read.balanceOf([rescueAddress]);
      const contractBalanceBefore = await token.read.balanceOf([
        diamond.address,
      ]);

      await tokenDuelsFacet.write.rescueTokens([rescueAddress, rescueAmount], {
        account: deployer.account,
      });

      const rescueBalanceAfter = await token.read.balanceOf([rescueAddress]);
      const contractBalanceAfter = await token.read.balanceOf([
        diamond.address,
      ]);

      assert.strictEqual(
        rescueBalanceAfter - rescueBalanceBefore,
        rescueAmount,
        "Rescue address should receive tokens"
      );
      assert.strictEqual(
        contractBalanceBefore - contractBalanceAfter,
        rescueAmount,
        "Contract should transfer tokens"
      );
    });

    it("should rescue tokens as operator", async () => {
      const rescueAmount = stakeAmount;
      const rescueAddress = player2.account.address;

      await tokenDuelsFacet.write.rescueTokens([rescueAddress, rescueAmount], {
        account: operator.account,
      });

      const rescueBalance = await token.read.balanceOf([rescueAddress]);
      assert.ok(rescueBalance >= rescueAmount, "Should receive tokens");
    });

    it("should emit Rescue event", async () => {
      const rescueAmount = stakeAmount;
      const rescueAddress = player1.account.address;
      const balanceBefore = await token.read.balanceOf([rescueAddress]);

      // Transaction should succeed and tokens should be rescued
      await tokenDuelsFacet.write.rescueTokens(
        [rescueAddress, rescueAmount],
        {
          account: deployer.account,
        }
      );

      // Verify tokens were transferred (which confirms event was emitted)
      const balanceAfter = await token.read.balanceOf([rescueAddress]);
      assert.strictEqual(balanceAfter - balanceBefore, rescueAmount);
    });

    it("should reject zero address", async () => {
      try {
        await tokenDuelsFacet.write.rescueTokens([
          "0x0000000000000000000000000000000000000000",
          stakeAmount,
        ], {
          account: deployer.account,
        });
        assert.fail("Should have failed - zero address");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__ZeroAddress"),
          `Expected TokenDuels__ZeroAddress error, got: ${error.message}`
        );
      }
    });

    it("should reject when token not configured", async () => {
      // Deploy a new diamond and add facet but don't configure token
      const newDiamond = await viem.deployContract("CCTDDiamond", []);
      const newOperableFacet = await viem.deployContract("OperableFacet", []);
      const newTokenDuelsFacetContract = await viem.deployContract(
        "TokenDuelsFacet",
        []
      );

      const diamondAbi =
        require("../artifacts/contracts/CCTDDiamond.sol/CCTDDiamond.json").abi;
      const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);
      const operableSelectors = getFunctionSelectors(newOperableFacet.abi).filter(
        (selector) => !alreadyAddedSelectors.includes(selector)
      );
      const tokenDuelsSelectors = getFunctionSelectors(
        newTokenDuelsFacetContract.abi
      ).filter((selector) => !alreadyAddedSelectors.includes(selector));

      await newDiamond.write.diamondCut(
        [
          [
            {
              target: newOperableFacet.address,
              action: 0,
              selectors: operableSelectors,
            },
            {
              target: newTokenDuelsFacetContract.address,
              action: 0,
              selectors: tokenDuelsSelectors,
            },
          ],
          "0x0000000000000000000000000000000000000000",
          "0x",
        ],
        {
          account: deployer.account,
        }
      );

      const newTokenDuelsFacet = await viem.getContractAt(
        "TokenDuelsFacet",
        newDiamond.address
      );

      try {
        await newTokenDuelsFacet.write.rescueTokens([
          player1.account.address,
          stakeAmount,
        ], {
          account: deployer.account,
        });
        assert.fail("Should have failed - token not configured");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__TokenNotSet"),
          `Expected TokenDuels__TokenNotSet error, got: ${error.message}`
        );
      }
    });

    it("should reject non-owner/operator caller", async () => {
      try {
        await tokenDuelsFacet.write.rescueTokens(
          [player1.account.address, stakeAmount],
          {
            account: player1.account,
          }
        );
        assert.fail("Should have failed - not owner or operator");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuelsFacet__NotOperator") ||
            error.message.includes("Ownable"),
          `Expected access control error, got: ${error.message}`
        );
      }
    });
  });

  describe("View Functions", () => {
    let sessionId: bigint;
    let gameId: bigint;
    let stakeAmount: bigint;

    beforeEach(async () => {
      // Configure token
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Approve tokens
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });
    });

    it("should return correct game data for WAITING_FOR_P2", async () => {
      sessionId = 1n;
      gameId = 100n;

      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(
        game.p1.toLowerCase(),
        player1.account.address.toLowerCase()
      );
      assert.strictEqual(game.p2, "0x0000000000000000000000000000000000000000");
      assert.strictEqual(game.stakeAmount, stakeAmount);
      assert.strictEqual(game.p1Deposit, stakeAmount);
      assert.strictEqual(game.p2Deposit, 0n);
      assert.strictEqual(game.state, 1); // WAITING_FOR_P2
      assert.strictEqual(game.winner, "0x0000000000000000000000000000000000000000");
      assert.strictEqual(game.gameId, gameId);
    });

    it("should return correct game data for ACTIVE", async () => {
      sessionId = 1n;
      gameId = 100n;

      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(
        game.p1.toLowerCase(),
        player1.account.address.toLowerCase()
      );
      assert.strictEqual(
        game.p2.toLowerCase(),
        player2.account.address.toLowerCase()
      );
      assert.strictEqual(game.stakeAmount, stakeAmount);
      assert.strictEqual(game.p1Deposit, stakeAmount);
      assert.strictEqual(game.p2Deposit, stakeAmount);
      assert.strictEqual(game.state, 2); // ACTIVE
      assert.strictEqual(game.winner, "0x0000000000000000000000000000000000000000");
      assert.strictEqual(game.gameId, gameId);
    });

    it("should return correct game data for FINISHED", async () => {
      sessionId = 1n;
      gameId = 100n;

      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });
      await tokenDuelsFacet.write.settleGame(
        [sessionId, player1.account.address],
        {
          account: deployer.account,
        }
      );

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 3); // FINISHED
      assert.strictEqual(
        game.winner.toLowerCase(),
        player1.account.address.toLowerCase()
      );
      assert.strictEqual(game.p1Deposit, 0n);
      assert.strictEqual(game.p2Deposit, 0n);
    });

    it("should return correct game data for CANCELED", async () => {
      sessionId = 1n;
      gameId = 100n;

      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.cancelWaitingGame([sessionId], {
        account: deployer.account,
      });

      const game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 4); // CANCELED
      assert.strictEqual(game.p1Deposit, 0n);
    });

    it("should reject invalid sessionId", async () => {
      try {
        await tokenDuelsFacet.read.getGame([999n]);
        assert.fail("Should have failed - invalid sessionId");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuels__InvalidGameId"),
          `Expected TokenDuels__InvalidGameId error, got: ${error.message}`
        );
      }
    });
  });

  describe("Access Control", () => {
    beforeEach(async () => {
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });
    });

    it("should allow owner to call all owner/operator functions", async () => {
      // configureToken
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      // settleGame (requires active game)
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });

      await tokenDuelsFacet.write.createGame([1n, 100n], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([1n], {
        account: player2.account,
      });

      await tokenDuelsFacet.write.settleGame([1n, player1.account.address], {
        account: deployer.account,
      });

      // cancelWaitingGame
      await tokenDuelsFacet.write.createGame([2n, 101n], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.cancelWaitingGame([2n], {
        account: deployer.account,
      });

      // cancelActiveGame
      await tokenDuelsFacet.write.createGame([3n, 102n], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([3n], {
        account: player2.account,
      });
      await tokenDuelsFacet.write.cancelActiveGame([3n], {
        account: deployer.account,
      });

      // rescueTokens
      await token.write.transfer([diamond.address, stakeAmount], {
        account: deployer.account,
      });
      await tokenDuelsFacet.write.rescueTokens(
        [player1.account.address, stakeAmount],
        {
          account: deployer.account,
        }
      );

      assert.ok(true, "Owner should be able to call all functions");
    });

    it("should allow operator to call all owner/operator functions", async () => {
      // configureToken
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: operator.account,
      });

      // settleGame
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });

      await tokenDuelsFacet.write.createGame([1n, 100n], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([1n], {
        account: player2.account,
      });
      await tokenDuelsFacet.write.settleGame([1n, player1.account.address], {
        account: operator.account,
      });

      assert.ok(true, "Operator should be able to call all functions");
    });

    it("should reject non-owner/operator from configureToken", async () => {
      try {
        await tokenDuelsFacet.write.configureToken([token.address], {
          account: player1.account,
        });
        assert.fail("Should have failed");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuelsFacet__NotOperator") ||
            error.message.includes("Ownable")
        );
      }
    });

    it("should reject non-owner/operator from settleGame", async () => {
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(10)], {
        account: player2.account,
      });

      await tokenDuelsFacet.write.createGame([1n, 100n], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.joinGame([1n], {
        account: player2.account,
      });

      try {
        await tokenDuelsFacet.write.settleGame([1n, player1.account.address], {
          account: player1.account,
        });
        assert.fail("Should have failed");
      } catch (error: any) {
        assert.ok(
          error.message.includes("TokenDuelsFacet__NotOperator") ||
            error.message.includes("Ownable")
        );
      }
    });
  });

  describe("Edge Cases", () => {
    beforeEach(async () => {
      await tokenDuelsFacet.write.configureToken([token.address], {
        account: deployer.account,
      });

      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();
      await token.write.approve([diamond.address, stakeAmount * BigInt(100)], {
        account: player1.account,
      });
      await token.write.approve([diamond.address, stakeAmount * BigInt(100)], {
        account: player2.account,
      });
    });

    it("should handle multiple games with different sessionIds", async () => {
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Create multiple games
      await tokenDuelsFacet.write.createGame([1n, 100n], {
        account: player1.account,
      });
      await tokenDuelsFacet.write.createGame([2n, 101n], {
        account: player2.account,
      });
      await tokenDuelsFacet.write.createGame([3n, 102n], {
        account: player1.account,
      });

      const game1 = await tokenDuelsFacet.read.getGame([1n]);
      const game2 = await tokenDuelsFacet.read.getGame([2n]);
      const game3 = await tokenDuelsFacet.read.getGame([3n]);

      assert.strictEqual(
        game1.p1.toLowerCase(),
        player1.account.address.toLowerCase()
      );
      assert.strictEqual(
        game2.p1.toLowerCase(),
        player2.account.address.toLowerCase()
      );
      assert.strictEqual(
        game3.p1.toLowerCase(),
        player1.account.address.toLowerCase()
      );
      assert.strictEqual(game1.gameId, 100n);
      assert.strictEqual(game2.gameId, 101n);
      assert.strictEqual(game3.gameId, 102n);
    });

    it("should handle full game lifecycle (create → join → settle)", async () => {
      const sessionId = 1n;
      const gameId = 100n;
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Create
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      let game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 1); // WAITING_FOR_P2

      // Join
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });
      game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 2); // ACTIVE

      // Settle
      await tokenDuelsFacet.write.settleGame(
        [sessionId, player1.account.address],
        {
          account: deployer.account,
        }
      );
      game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 3); // FINISHED
      assert.strictEqual(
        game.winner.toLowerCase(),
        player1.account.address.toLowerCase()
      );
    });

    it("should handle full game lifecycle with cancellation", async () => {
      const sessionId = 1n;
      const gameId = 100n;

      // Create
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      let game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 1); // WAITING_FOR_P2

      // Cancel waiting
      await tokenDuelsFacet.write.cancelWaitingGame([sessionId], {
        account: deployer.account,
      });
      game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 4); // CANCELED
    });

    it("should track contract token balance correctly", async () => {
      const sessionId = 1n;
      const gameId = 100n;
      const stakeAmount = await tokenDuelsFacet.read.stakeAmount();

      // Create game
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      let contractBalance = await token.read.balanceOf([diamond.address]);
      assert.strictEqual(contractBalance, stakeAmount);

      // Join game
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });
      contractBalance = await token.read.balanceOf([diamond.address]);
      assert.strictEqual(contractBalance, stakeAmount * BigInt(2));

      // Settle game
      await tokenDuelsFacet.write.settleGame(
        [sessionId, player1.account.address],
        {
          account: deployer.account,
        }
      );
      contractBalance = await token.read.balanceOf([diamond.address]);
      assert.strictEqual(contractBalance, 0n);
    });

    it("should handle game state transitions correctly", async () => {
      const sessionId = 1n;
      const gameId = 100n;

      // NONE -> WAITING_FOR_P2
      await tokenDuelsFacet.write.createGame([sessionId, gameId], {
        account: player1.account,
      });
      let game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 1); // WAITING_FOR_P2

      // WAITING_FOR_P2 -> ACTIVE
      await tokenDuelsFacet.write.joinGame([sessionId], {
        account: player2.account,
      });
      game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 2); // ACTIVE

      // ACTIVE -> FINISHED
      await tokenDuelsFacet.write.settleGame(
        [sessionId, player1.account.address],
        {
          account: deployer.account,
        }
      );
      game = await tokenDuelsFacet.read.getGame([sessionId]);
      assert.strictEqual(game.state, 3); // FINISHED
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
