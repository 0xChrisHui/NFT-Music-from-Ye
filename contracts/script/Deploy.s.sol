// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MaterialNFT.sol";

/**
 * Phase 1 部署脚本 — 自定义 MaterialNFT
 *
 * deployer = DEFAULT_ADMIN_ROLE（管理角色 + 更新 URI）
 * minter 参数 = MINTER_ROLE（运营钱包，调 mint）
 *
 * 用法：
 * forge script script/Deploy.s.sol --rpc-url $ALCHEMY_RPC_URL \
 *   --private-key $OPERATOR_PRIVATE_KEY --broadcast -vv
 */
contract Deploy is Script {
    function run() external {
        address minter = msg.sender;

        vm.startBroadcast();

        MaterialNFT nft = new MaterialNFT(
            "https://placeholder.ripples/{id}.json",
            minter
        );

        console.log("MaterialNFT deployed at:", address(nft));
        console.log("Minter (MINTER_ROLE):", minter);

        vm.stopBroadcast();
    }
}
