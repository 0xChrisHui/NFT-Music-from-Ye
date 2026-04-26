// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MaterialNFT.sol";

/**
 * Phase 6 C2 部署脚本 — MaterialNFT，admin / minter 分离
 *
 * 主网权限模型见 DeployScore.s.sol 注释。测试网兼容：env 缺省时回退 deployer。
 *
 * 用法：
 *   cd contracts
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address minter = vm.envOr("MINTER_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);

        MaterialNFT nft = new MaterialNFT(
            "https://placeholder.ripples/{id}.json",
            minter
        );

        if (admin != deployer) {
            nft.grantRole(nft.DEFAULT_ADMIN_ROLE(), admin);
            nft.revokeRole(nft.DEFAULT_ADMIN_ROLE(), deployer);
        }

        vm.stopBroadcast();

        console.log("MaterialNFT:", address(nft));
        console.log("Deployer:   ", deployer);
        console.log("Admin:      ", admin);
        console.log("Minter:     ", minter);
    }
}
