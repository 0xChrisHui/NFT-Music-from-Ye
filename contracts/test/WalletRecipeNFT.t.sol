// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {WalletRecipeNFT} from "../src/WalletRecipeNFT.sol";

contract RecipeReceiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract RecipeNonReceiver {}

contract WalletRecipeNFTTest is Test {
    WalletRecipeNFT private nft;

    address private deployer = address(0xD3);
    address private admin = address(0xA11CE);
    address private minter = address(0xB0B);
    address private origin = address(0xC0FFEE);
    address private collector = address(0xCAFE);
    address private outsider = address(0xDEAD);

    string private constant TOKEN_URI = "ar://token-metadata";
    string private constant COLLECTION_URI = "ar://collection-metadata";

    event WalletRecipeMinted(address indexed originWallet, uint256 indexed tokenId);

    function setUp() public {
        vm.prank(deployer);
        nft = new WalletRecipeNFT("Pond Echoes", "ECHO", COLLECTION_URI, admin, minter);
    }

    function testConstructorFreezesIdentityAndSeparatesRoles() public view {
        assertEq(nft.name(), "Pond Echoes");
        assertEq(nft.symbol(), "ECHO");
        assertEq(nft.contractURI(), COLLECTION_URI);
        assertEq(nft.owner(), admin);
        assertTrue(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(nft.hasRole(nft.MINTER_ROLE(), minter));
        assertFalse(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), deployer));
        assertFalse(nft.hasRole(nft.MINTER_ROLE(), admin));
    }

    function testMintStartsAtOneAndWritesPermanentOriginAndUri() public {
        vm.expectEmit(true, true, false, false);
        emit WalletRecipeMinted(origin, 1);

        vm.prank(minter);
        uint256 tokenId = nft.mintToOrigin(origin, TOKEN_URI);

        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), origin);
        assertEq(nft.originWalletOf(tokenId), origin);
        assertEq(nft.tokenIdByOrigin(origin), tokenId);
        assertEq(nft.tokenURI(tokenId), TOKEN_URI);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), tokenId);
        assertEq(nft.tokenOfOwnerByIndex(origin, 0), tokenId);
    }

    function testDifferentOriginsReceiveDifferentTokens() public {
        address secondOrigin = address(0xBEEF);
        vm.startPrank(minter);
        assertEq(nft.mintToOrigin(origin, TOKEN_URI), 1);
        assertEq(nft.mintToOrigin(secondOrigin, "ar://second"), 2);
        vm.stopPrank();

        assertEq(nft.ownerOf(2), secondOrigin);
        assertEq(nft.tokenIdByOrigin(secondOrigin), 2);
    }

    function testSameOriginCannotMintAgainWithSameOrDifferentUri() public {
        vm.prank(minter);
        nft.mintToOrigin(origin, TOKEN_URI);

        vm.startPrank(minter);
        vm.expectRevert(abi.encodeWithSelector(WalletRecipeNFT.OriginAlreadyMinted.selector, origin, 1));
        nft.mintToOrigin(origin, TOKEN_URI);
        vm.expectRevert(abi.encodeWithSelector(WalletRecipeNFT.OriginAlreadyMinted.selector, origin, 1));
        nft.mintToOrigin(origin, "ar://different");
        vm.stopPrank();
    }

    function testAddressCasingCannotCreateAnotherOrigin() public {
        address lowercaseAddress = vm.parseAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
        address checksumAddress = vm.parseAddress("0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD");
        assertEq(lowercaseAddress, checksumAddress);

        vm.prank(minter);
        nft.mintToOrigin(lowercaseAddress, TOKEN_URI);
        vm.prank(minter);
        vm.expectRevert();
        nft.mintToOrigin(checksumAddress, "ar://second");
    }

    function testRejectsUnauthorizedZeroOriginAndEmptyUri() public {
        vm.prank(outsider);
        vm.expectRevert();
        nft.mintToOrigin(origin, TOKEN_URI);

        vm.startPrank(minter);
        vm.expectRevert(WalletRecipeNFT.ZeroOrigin.selector);
        nft.mintToOrigin(address(0), TOKEN_URI);
        vm.expectRevert(WalletRecipeNFT.EmptyTokenURI.selector);
        nft.mintToOrigin(origin, "");
        vm.stopPrank();
    }

    function testNonReceiverRevertsAndRollsBackOriginState() public {
        RecipeNonReceiver target = new RecipeNonReceiver();
        vm.prank(minter);
        vm.expectRevert();
        nft.mintToOrigin(address(target), TOKEN_URI);

        assertEq(nft.tokenIdByOrigin(address(target)), 0);
        assertEq(nft.totalSupply(), 0);

        vm.prank(minter);
        assertEq(nft.mintToOrigin(origin, TOKEN_URI), 1);
    }

    function testTransfersKeepOriginAndBlockRemint() public {
        vm.prank(minter);
        nft.mintToOrigin(origin, TOKEN_URI);

        vm.prank(origin);
        nft.transferFrom(origin, collector, 1);
        assertEq(nft.ownerOf(1), collector);
        assertEq(nft.originWalletOf(1), origin);
        assertEq(nft.tokenIdByOrigin(origin), 1);

        RecipeReceiver receiver = new RecipeReceiver();
        vm.prank(collector);
        nft.safeTransferFrom(collector, address(receiver), 1);
        assertEq(nft.ownerOf(1), address(receiver));
        assertEq(nft.originWalletOf(1), origin);

        vm.prank(minter);
        vm.expectRevert();
        nft.mintToOrigin(origin, "ar://again");
    }

    function testAdminCanGrantAndRevokeMinterImmediately() public {
        bytes32 minterRole = nft.MINTER_ROLE();
        vm.prank(admin);
        nft.grantRole(minterRole, outsider);
        vm.prank(outsider);
        nft.mintToOrigin(origin, TOKEN_URI);

        vm.prank(admin);
        nft.revokeRole(minterRole, outsider);
        vm.prank(outsider);
        vm.expectRevert();
        nft.mintToOrigin(address(0x1234), "ar://blocked");
    }

    function testInterfacesAndOmittedCapabilities() public {
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC-165
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(nft.supportsInterface(0x5b5e139f)); // metadata
        assertTrue(nft.supportsInterface(0x780e9d63)); // Enumerable
        assertTrue(nft.supportsInterface(0x7965db0b)); // AccessControl
        assertTrue(nft.supportsInterface(0x7f5828d0)); // ERC-173
        assertTrue(nft.supportsInterface(0xe8a3d485)); // ERC-7572
        assertFalse(nft.supportsInterface(0x2a55205a)); // ERC-2981

        vm.prank(minter);
        nft.mintToOrigin(origin, TOKEN_URI);
        (bool burned,) = address(nft).call(abi.encodeWithSignature("burn(uint256)", 1));
        (bool paused,) = address(nft).call(abi.encodeWithSignature("pause()"));
        (bool changedUri,) =
            address(nft).call(abi.encodeWithSignature("setTokenURI(uint256,string)", 1, "ar://changed"));
        assertFalse(burned);
        assertFalse(paused);
        assertFalse(changedUri);
    }

    function testFuzzOriginUniqueAfterArbitraryTransfers(address fuzzOrigin, address firstOwner, address secondOwner)
        public
    {
        vm.assume(fuzzOrigin != address(0));
        vm.assume(firstOwner != address(0) && firstOwner.code.length == 0);
        vm.assume(secondOwner != address(0) && secondOwner.code.length == 0);

        vm.prank(minter);
        nft.mintToOrigin(fuzzOrigin, TOKEN_URI);
        vm.prank(fuzzOrigin);
        nft.transferFrom(fuzzOrigin, firstOwner, 1);
        vm.prank(firstOwner);
        nft.transferFrom(firstOwner, secondOwner, 1);

        assertEq(nft.ownerOf(1), secondOwner);
        assertEq(nft.originWalletOf(1), fuzzOrigin);
        assertEq(nft.tokenIdByOrigin(fuzzOrigin), 1);
        vm.prank(minter);
        vm.expectRevert();
        nft.mintToOrigin(fuzzOrigin, "ar://duplicate");
    }
}
