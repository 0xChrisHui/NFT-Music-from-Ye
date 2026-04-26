// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ScoreNFT.sol";

/**
 * Phase 6 C2 部署脚本 — ScoreNFT，admin / minter 分离
 *
 * 主网权限模型（D-C1）：
 *   ADMIN_ADDRESS  = 冷钱包（DEFAULT_ADMIN_ROLE）
 *   MINTER_ADDRESS = 运营热钱包（MINTER_ROLE）
 *   deployer = DEPLOYER_PRIVATE_KEY 派生地址，部署后 revoke 多余角色
 *
 * 测试网兼容：ADMIN_ADDRESS / MINTER_ADDRESS 留空时
 *   自动回退到 deployer = admin = minter（vm.envOr）
 *
 * 用法：
 *   cd contracts
 *   forge script script/DeployScore.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 *
 * 详细 runbook：docs/MAINNET-RUNBOOK.md
 */
contract DeployScore is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address minter = vm.envOr("MINTER_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);

        ScoreNFT nft = new ScoreNFT(
            "Ripples in the Pond Score (Testnet)",
            "RIPS",
            minter
        );

        // 主网模式：admin 与 deployer 不同，移交 DEFAULT_ADMIN_ROLE
        if (admin != deployer) {
            nft.grantRole(nft.DEFAULT_ADMIN_ROLE(), admin);
            nft.revokeRole(nft.DEFAULT_ADMIN_ROLE(), deployer);
        }
        // 💭 minter 已在构造函数 _grantRole；deployer 默认无 MINTER_ROLE 不用 revoke

        vm.stopBroadcast();

        console.log("ScoreNFT:", address(nft));
        console.log("Name:    ", nft.name());
        console.log("Symbol:  ", nft.symbol());
        console.log("Deployer:", deployer);
        console.log("Admin:   ", admin);
        console.log("Minter:  ", minter);
    }
}
