// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MintOrchestrator.sol";
import "../src/ScoreNFT.sol";

/**
 * Phase 6 C3 — 测试网手动跑的"端到端验证 mint"
 *
 * 从 DeployOrchestrator 拆出来：
 *   主网照跑 mintScore(deployer) = 合集 tokenId 1 永久无 metadata
 *   所以验证 mint 改成独立脚本，**只在测试网手动跑**，主网绝不调
 *
 * 前置：DeployOrchestrator 已部署 + admin 已 grantRole MINTER_ROLE 给 Orchestrator
 *      签名钱包必须持有 Orchestrator.MINTER_ROLE（测试网通常 = deployer = minter）
 *
 * 用法（测试网）：
 *   cd contracts
 *   forge script script/TestMintOrchestrator.s.sol \
 *     --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
 */
contract TestMintOrchestrator is Script {
    function run() external {
        uint256 minterKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address minter = vm.addr(minterKey);
        address orchestratorAddr = vm.envAddress("NEXT_PUBLIC_ORCHESTRATOR_ADDRESS");
        address scoreNftAddr = vm.envAddress("NEXT_PUBLIC_SCORE_NFT_ADDRESS");

        vm.startBroadcast(minterKey);
        uint256 tokenId = MintOrchestrator(orchestratorAddr).mintScore(minter);
        vm.stopBroadcast();

        console.log("Test mint OK, tokenId:", tokenId);
        console.log("Owner:", ScoreNFT(scoreNftAddr).ownerOf(tokenId));
    }
}
