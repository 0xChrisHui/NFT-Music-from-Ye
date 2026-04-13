// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AirdropNFT.sol";

/**
 * AirdropNFT 单元测试 — Phase 4 Step S6
 * 复用 ScoreNFT 测试结构，验证独立合约行为
 */
contract AirdropNFTTest is Test {
    AirdropNFT nft;

    address admin = address(0xA11CE);
    address minter = address(0xB0B);
    address user = address(0xC0FFEE);
    address outsider = address(0xDEADBEEF);

    function setUp() public {
        vm.prank(admin);
        nft = new AirdropNFT(
            "Ripples in the Pond Airdrop (Testnet)",
            "RIPA",
            minter
        );
    }

    function testNameAndSymbol() public view {
        assertEq(nft.name(), "Ripples in the Pond Airdrop (Testnet)");
        assertEq(nft.symbol(), "RIPA");
    }

    function testMintStartsFromOne() public {
        vm.prank(minter);
        uint256 id = nft.mint(user);
        assertEq(id, 1);
        assertEq(nft.ownerOf(1), user);
    }

    function testMintIncrements() public {
        vm.startPrank(minter);
        assertEq(nft.mint(user), 1);
        assertEq(nft.mint(user), 2);
        assertEq(nft.mint(outsider), 3);
        vm.stopPrank();
    }

    function testMintRevertsForNonMinter() public {
        vm.prank(outsider);
        vm.expectRevert();
        nft.mint(user);
    }

    function testSetTokenURI() public {
        vm.prank(minter);
        uint256 id = nft.mint(user);
        vm.prank(minter);
        nft.setTokenURI(id, "ar://test");
        assertEq(nft.tokenURI(id), "ar://test");
    }

    function testSetTokenURIRevertsForNonMinter() public {
        vm.prank(minter);
        uint256 id = nft.mint(user);
        vm.prank(outsider);
        vm.expectRevert();
        nft.setTokenURI(id, "ar://bad");
    }
}
