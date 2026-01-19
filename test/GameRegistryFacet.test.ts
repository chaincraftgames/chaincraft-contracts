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

describe("GameRegistryFacet", () => {
  let diamond: any;
  let operableFacet: any;
  let eip712Facet: any;
  let gameRegistryFacet: any;
  let deployer: any;
  let operator: any;
  let user1: any;
  let user2: any;
  let viem: any;
  let chainId: number;

  // Helper to create EIP-712 signature for game publishing
  async function createPublishGameSignature(
    uuid: string,
    to: string,
    gameURI: string,
    deadline: bigint,
    signer: any,
    diamondAddress: string,
    chainId: number
  ) {
    // Use signTypedData which properly constructs and signs EIP-712 typed data
    // This matches what the contract expects
    return await signer.signTypedData({
      domain: {
        name: "ChainCraft",
        version: "1",
        chainId,
        verifyingContract: diamondAddress as `0x${string}`,
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
        to: to as `0x${string}`,
        gameURI,
        deadline,
      },
    });
  }

  // Helper to create EIP-712 signature for updating game URI
  async function createUpdateGameURISignature(
    uuid: string,
    newURI: string,
    deadline: bigint,
    signer: any,
    diamondAddress: string,
    chainId: number
  ) {
    return await signer.signTypedData({
      domain: {
        name: "ChainCraft",
        version: "1",
        chainId,
        verifyingContract: diamondAddress as `0x${string}`,
      },
      types: {
        UpdateGameURI: [
          { name: "uuid", type: "string" },
          { name: "newURI", type: "string" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "UpdateGameURI",
      message: {
        uuid,
        newURI,
        deadline,
      },
    });
  }

  beforeEach(async () => {
    const network_result = await network.connect();
    viem = network_result.viem;
    const publicClient = viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    [deployer, operator, user1, user2] = walletClients;
    // Get chainId - hardhat default is 31337
    chainId = 31337;

    // Deploy the Diamond contract
    diamond = await viem.deployContract("CCGRDiamond", []);

    // Deploy OperableFacet
    const operableFacetContract = await viem.deployContract(
      "OperableFacet",
      []
    );

    // Deploy EIP712Facet
    const eip712FacetContract = await viem.deployContract("EIP712Facet", []);

    // Deploy GameRegistryFacet
    const gameRegistryFacetContract = await viem.deployContract(
      "GameRegistryFacet",
      []
    );

    // Get function selectors
    const diamondAbi =
      require("../artifacts/contracts/CCGRDiamond.sol/CCGRDiamond.json").abi;
    const alreadyAddedSelectors = getFunctionSelectors(diamondAbi);

    const operableFacetSelectors = getFunctionSelectors(
      operableFacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    const eip712FacetSelectors = getFunctionSelectors(
      eip712FacetContract.abi
    ).filter((selector) => !alreadyAddedSelectors.includes(selector));

    const gameRegistryFacetSelectors = getFunctionSelectors(
      gameRegistryFacetContract.abi
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
            target: eip712FacetContract.address,
            action: 0, // Add
            selectors: eip712FacetSelectors,
          },
          {
            target: gameRegistryFacetContract.address,
            action: 0, // Add
            selectors: gameRegistryFacetSelectors,
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
    eip712Facet = await viem.getContractAt("EIP712Facet", diamond.address);
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
        assert.ok(
          error.message.includes("Initializable__AlreadyInitialized"),
          `Expected Initializable__AlreadyInitialized error, got: ${error.message}`
        );
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

    it("should not allow adding zero address as operator", async () => {
      try {
        await operableFacet.write.addOperator(
          ["0x0000000000000000000000000000000000000000"],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - zero address");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Operable__ZeroAddress"),
          `Expected Operable__ZeroAddress error, got: ${error.message}`
        );
      }
    });

    it("should not allow adding duplicate operator", async () => {
      try {
        // operator was already added in beforeEach
        await operableFacet.write.addOperator([operator.account.address], {
          account: deployer.account,
        });
        assert.fail("Should have failed - duplicate operator");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Operable__AlreadyOperator"),
          `Expected Operable__AlreadyOperator error, got: ${error.message}`
        );
      }
    });

    it("should not allow removing non-existent operator", async () => {
      try {
        await operableFacet.write.removeOperator([user2.account.address], {
          account: deployer.account,
        });
        assert.fail("Should have failed - operator does not exist");
      } catch (error: any) {
        assert.ok(
          error.message.includes("Operable__NotOperator"),
          `Expected Operable__NotOperator error, got: ${error.message}`
        );
      }
    });
  });

  describe("Game Publishing", () => {
    it("should publish a game as operator", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const gameURI = "ipfs://Qm.../game-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        uuid,
        user1.account.address,
        gameURI,
        deadline,
        user1,
        diamond.address,
        chainId
      );

      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, gameURI, deadline, signature],
        {
          account: operator.account,
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

    it("should not allow non-operator to publish game", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440002";
      const gameURI = "ipfs://Qm.../game-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        uuid,
        user1.account.address,
        gameURI,
        deadline,
        user1,
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user1.account.address, gameURI, deadline, signature],
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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        "",
        user1.account.address,
        gameURI,
        deadline,
        user1,
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.publishGame(
          ["", user1.account.address, gameURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - empty UUID");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__EmptyUUID"));
      }
    });

    it("should not allow publishing with empty URI", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440003";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        uuid,
        user1.account.address,
        "",
        deadline,
        user1,
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user1.account.address, "", deadline, signature],
          {
            account: operator.account,
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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        uuid,
        "0x0000000000000000000000000000000000000000",
        gameURI,
        deadline,
        user1,
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.publishGame(
          [
            uuid,
            "0x0000000000000000000000000000000000000000",
            gameURI,
            deadline,
            signature,
          ],
          {
            account: operator.account,
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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        uuid,
        user1.account.address,
        gameURI,
        deadline,
        user1,
        diamond.address,
        chainId
      );

      // First publish
      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, gameURI, deadline, signature],
        {
          account: operator.account,
        }
      );

      // Try to publish again with same UUID
      const signature2 = await createPublishGameSignature(
        uuid,
        user2.account.address,
        gameURI,
        deadline,
        user2,
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.publishGame(
          [uuid, user2.account.address, gameURI, deadline, signature2],
          {
            account: operator.account,
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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        uuid,
        user1.account.address,
        gameURI,
        deadline,
        user1,
        diamond.address,
        chainId
      );

      await gameRegistryFacet.write.publishGame(
        [uuid, user1.account.address, gameURI, deadline, signature],
        {
          account: operator.account,
        }
      );
      tokenId = 1n;
    });

    it("should allow operator to update game URI by token ID", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Get the token owner (user1) to sign the update
      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user1, // token owner must sign
        diamond.address,
        chainId
      );

      await gameRegistryFacet.write.updateGameURI(
        [tokenId, newURI, deadline, signature],
        {
          account: operator.account,
        }
      );

      const retrievedURI = await gameRegistryFacet.read.tokenURI([tokenId]);
      assert.strictEqual(retrievedURI, newURI);
    });

    it("should allow operator to update game URI by UUID", async () => {
      const newURI = "ipfs://Qm.../updated-metadata-2.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Get the token owner (user1) to sign the update
      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user1, // token owner must sign
        diamond.address,
        chainId
      );

      await gameRegistryFacet.write.updateGameURIByUUID(
        [uuid, newURI, deadline, signature],
        {
          account: operator.account,
        }
      );

      const retrievedURI = await gameRegistryFacet.read.tokenURI([tokenId]);
      assert.strictEqual(retrievedURI, newURI);
    });

    it("should not allow token holder to update game URI", async () => {
      const newURI = "ipfs://Qm.../malicious-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Token holder signs, but they're not an operator
      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user1, // user1 is the token holder
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature],
          {
            account: user1.account, // user1 is the token holder but not operator
          }
        );
        assert.fail("Should have failed - token holder cannot update URI");
      } catch (error: any) {
        assert.ok(
          error.message.includes("GameRegistryFacet__NotOperator"),
          `Expected GameRegistryFacet__NotOperator error, got: ${error.message}`
        );
      }
    });

    it("should not allow unauthorized user to update game URI", async () => {
      const newURI = "ipfs://Qm.../unauthorized-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Unauthorized user signs, but they're not the owner and not an operator
      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user2, // user2 is not the token owner
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature],
          {
            account: user2.account,
          }
        );
        assert.fail("Should have failed - not authorized");
      } catch (error: any) {
        // Should fail either because user2 is not operator, or because signature doesn't match owner
        const hasExpectedError =
          error.message.includes("GameRegistryFacet__NotOperator") ||
          error.message.includes("GameRegistry__SignerMismatch");
        assert.ok(
          hasExpectedError,
          `Expected GameRegistryFacet__NotOperator or SignerMismatch error, got: ${error.message}`
        );
      }
    });

    it("should not allow updating with empty URI", async () => {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Token owner signs with empty URI
      const signature = await createUpdateGameURISignature(
        uuid,
        "",
        deadline,
        user1, // token owner
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, "", deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - empty URI");
      } catch (error: any) {
        assert.ok(error.message.includes("GameRegistry__URICannotBeEmpty"));
      }
    });

    it("should not allow updating non-existent token", async () => {
      const newURI = "ipfs://Qm.../updated-metadata-4.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const fakeUUID = "550e8400-e29b-41d4-a716-446655440999";

      // Use deployer to sign (they're owner but token doesn't exist)
      const signature = await createUpdateGameURISignature(
        fakeUUID,
        newURI,
        deadline,
        deployer,
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [999n, newURI, deadline, signature],
          {
            account: deployer.account,
          }
        );
        assert.fail("Should have failed - token does not exist");
      } catch (error: any) {
        const hasExpectedError =
          error.message.includes("GameRegistry__TokenDoesNotExist") ||
          error.message.includes("EnumerableMap__NonExistentKey") ||
          error.message.includes("ERC721");

        assert.ok(hasExpectedError, `Got unexpected error: ${error.message}`);
      }
    });

    it("should reject expired signature", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago (expired)

      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user1, // token owner
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - expired signature");
      } catch (error: any) {
        assert.ok(
          error.message.includes("EIP712__SignatureExpired"),
          `Expected EIP712__SignatureExpired error, got: ${error.message}`
        );
      }
    });

    it("should prevent signature replay attacks", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user1, // token owner
        diamond.address,
        chainId
      );

      // First use should succeed
      await gameRegistryFacet.write.updateGameURI(
        [tokenId, newURI, deadline, signature],
        {
          account: operator.account,
        }
      );

      // Try to replay the same signature (should fail)
      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have prevented signature replay");
      } catch (error: any) {
        assert.ok(
          error.message.includes("EIP712__SignatureAlreadyUsed"),
          `Expected EIP712__SignatureAlreadyUsed error, got: ${error.message}`
        );
      }
    });

    it("should reject signature from non-owner", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // user2 signs (not the token owner)
      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user2, // user2 is NOT the token owner
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - signature from non-owner");
      } catch (error: any) {
        assert.ok(
          error.message.includes("GameRegistry__SignerMismatch"),
          `Expected GameRegistry__SignerMismatch error, got: ${error.message}`
        );
      }
    });

    it("should reject signature with wrong UUID", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const wrongUUID = "550e8400-e29b-41d4-a716-446655440999";

      // Token owner signs with wrong UUID
      const signature = await createUpdateGameURISignature(
        wrongUUID, // wrong UUID
        newURI,
        deadline,
        user1, // token owner
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - signature with wrong UUID");
      } catch (error: any) {
        assert.ok(
          error.message.includes("GameRegistry__SignerMismatch"),
          `Expected GameRegistry__SignerMismatch error, got: ${error.message}`
        );
      }
    });

    it("should reject signature with wrong newURI", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const wrongURI = "ipfs://Qm.../wrong-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Token owner signs with wrong URI
      const signature = await createUpdateGameURISignature(
        uuid,
        wrongURI, // wrong URI
        deadline,
        user1, // token owner
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature], // using different URI
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - signature with wrong URI");
      } catch (error: any) {
        assert.ok(
          error.message.includes("GameRegistry__SignerMismatch"),
          `Expected GameRegistry__SignerMismatch error, got: ${error.message}`
        );
      }
    });

    it("should reject signature with wrong deadline", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline1 = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const deadline2 = BigInt(Math.floor(Date.now() / 1000) + 7200); // different deadline

      // Token owner signs with deadline1
      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline1,
        user1, // token owner
        diamond.address,
        chainId
      );

      try {
        // Try to use signature with deadline2
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline2, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - signature with wrong deadline");
      } catch (error: any) {
        assert.ok(
          error.message.includes("GameRegistry__SignerMismatch"),
          `Expected GameRegistry__SignerMismatch error, got: ${error.message}`
        );
      }
    });

    it("should reject URI that is too long", async () => {
      // Create URI that exceeds MAX_URI_LENGTH of 1024
      // "ipfs://Qm" is 9 characters, so we need 1016 more to get 1025 total
      const newURI = "ipfs://Qm" + "x".repeat(1016); // 1025 characters (exceeds MAX_URI_LENGTH of 1024)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createUpdateGameURISignature(
        uuid,
        newURI,
        deadline,
        user1, // token owner
        diamond.address,
        chainId
      );

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, signature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - URI too long");
      } catch (error: any) {
        assert.ok(
          error.message.includes("GameRegistry__URITooLong"),
          `Expected GameRegistry__URITooLong error, got: ${error.message}`
        );
      }
    });

    it("should reject empty signature", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const emptySignature = "0x"; // Empty signature

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, emptySignature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - empty signature");
      } catch (error: any) {
        // Empty signature will fail at ECDSA validation (invalid length)
        assert.ok(
          error.message.includes("ECDSA__InvalidSignatureLength") ||
            error.message.includes("EIP712__InvalidSigner"),
          `Expected ECDSA__InvalidSignatureLength or EIP712__InvalidSigner error, got: ${error.message}`
        );
      }
    });

    it("should reject invalid signature format", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      // Invalid signature - wrong length (should be 65 bytes for ECDSA)
      const invalidSignature = "0x1234"; // Too short

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, invalidSignature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - invalid signature format");
      } catch (error: any) {
        // Invalid signature format will fail during recovery
        // Could be EIP712__InvalidSigner or a revert from ECDSA.recover
        const hasExpectedError =
          error.message.includes("EIP712__InvalidSigner") ||
          error.message.includes("ECDSA") ||
          error.message.includes("invalid signature");
        assert.ok(
          hasExpectedError,
          `Expected signature validation error, got: ${error.message}`
        );
      }
    });

    it("should reject garbage signature data", async () => {
      const newURI = "ipfs://Qm.../updated-metadata.json";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      // Garbage signature - correct length but invalid data
      const garbageSignature = "0x" + "00".repeat(65); // 65 bytes of zeros

      try {
        await gameRegistryFacet.write.updateGameURI(
          [tokenId, newURI, deadline, garbageSignature],
          {
            account: operator.account,
          }
        );
        assert.fail("Should have failed - garbage signature");
      } catch (error: any) {
        // Garbage signature will fail at ECDSA validation (invalid v value or invalid signer)
        const hasExpectedError =
          error.message.includes("ECDSA__InvalidV") ||
          error.message.includes("EIP712__InvalidSigner") ||
          error.message.includes("ECDSA");
        assert.ok(
          hasExpectedError,
          `Expected ECDSA validation error, got: ${error.message}`
        );
      }
    });

  });

  describe("View Functions", () => {
    let uuid1: string;
    let uuid2: string;

    beforeEach(async () => {
      uuid1 = "550e8400-e29b-41d4-a716-446655440007";
      uuid2 = "550e8400-e29b-41d4-a716-446655440008";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature1 = await createPublishGameSignature(
        uuid1,
        user1.account.address,
        "ipfs://Qm.../game1.json",
        deadline,
        user1,
        diamond.address,
        chainId
      );

      await gameRegistryFacet.write.publishGame(
        [
          uuid1,
          user1.account.address,
          "ipfs://Qm.../game1.json",
          deadline,
          signature1,
        ],
        {
          account: operator.account,
        }
      );

      const signature2 = await createPublishGameSignature(
        uuid2,
        user2.account.address,
        "ipfs://Qm.../game2.json",
        deadline,
        user2,
        diamond.address,
        chainId
      );

      await gameRegistryFacet.write.publishGame(
        [
          uuid2,
          user2.account.address,
          "ipfs://Qm.../game2.json",
          deadline,
          signature2,
        ],
        {
          account: operator.account,
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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createPublishGameSignature(
        uuid,
        user1.account.address,
        "ipfs://Qm.../game.json",
        deadline,
        user1,
        diamond.address,
        chainId
      );

      await gameRegistryFacet.write.publishGame(
        [
          uuid,
          user1.account.address,
          "ipfs://Qm.../game.json",
          deadline,
          signature,
        ],
        {
          account: operator.account,
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
