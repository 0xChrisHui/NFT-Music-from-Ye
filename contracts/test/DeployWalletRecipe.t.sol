// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeployWalletRecipe} from "../script/DeployWalletRecipe.s.sol";
import {WalletRecipeNFT} from "../src/WalletRecipeNFT.sol";

contract DeployWalletRecipeHarness is DeployWalletRecipe {
    function deployForTest(address admin, address minter, string memory collectionUri)
        external
        returns (WalletRecipeNFT)
    {
        return _deploy(admin, minter, collectionUri);
    }
}

contract DeployWalletRecipeTest is Test {
    string private constant COLLECTION_URI = "ar://CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
    DeployWalletRecipeHarness private script;

    address private admin = address(0xA11CE);
    address private minter = address(0xB0B);

    function setUp() public {
        script = new DeployWalletRecipeHarness();
    }

    function testDeploysFrozenIdentityAndRoles() public {
        WalletRecipeNFT nft = script.deployForTest(admin, minter, COLLECTION_URI);

        assertEq(nft.name(), "Pond Echoes");
        assertEq(nft.symbol(), "ECHO");
        assertEq(nft.contractURI(), COLLECTION_URI);
        assertEq(nft.owner(), admin);
        assertTrue(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(nft.hasRole(nft.MINTER_ROLE(), minter));
        assertFalse(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), address(script)));
    }

    function testRejectsEmptyAndUnsafeConstructorInputs() public {
        vm.expectRevert(WalletRecipeNFT.EmptyContractURI.selector);
        script.deployForTest(admin, minter, "");

        vm.expectRevert(WalletRecipeNFT.ZeroAdmin.selector);
        script.deployForTest(address(0), minter, COLLECTION_URI);

        vm.expectRevert(WalletRecipeNFT.ZeroMinter.selector);
        script.deployForTest(admin, address(0), COLLECTION_URI);

        vm.expectRevert(WalletRecipeNFT.RolesMustDiffer.selector);
        script.deployForTest(admin, admin, COLLECTION_URI);
    }

    function testDirectConstructorRejectsEmptyNameAndSymbol() public {
        vm.expectRevert(WalletRecipeNFT.EmptyName.selector);
        new WalletRecipeNFT("", "ECHO", COLLECTION_URI, admin, minter);

        vm.expectRevert(WalletRecipeNFT.EmptySymbol.selector);
        new WalletRecipeNFT("Pond Echoes", "", COLLECTION_URI, admin, minter);

        vm.expectRevert(WalletRecipeNFT.InvalidPermanentURI.selector);
        new WalletRecipeNFT("Pond Echoes", "ECHO", "https://example.com/collection", admin, minter);
    }
}
