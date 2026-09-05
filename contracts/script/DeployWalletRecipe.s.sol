// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {console} from "forge-std/console.sol";
import {DeployBase} from "./DeployBase.s.sol";
import {WalletRecipeNFT} from "../src/WalletRecipeNFT.sol";

/**
 * Pond Echoes 部署脚本。
 * 只部署合约；不会启用资格、修改环境变量或发送第二笔权限交易。
 */
contract DeployWalletRecipe is DeployBase {
    string public constant NFT_NAME = "Pond Echoes";
    string public constant NFT_SYMBOL = "ECHO";

    function run() external returns (WalletRecipeNFT nft) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        (address admin, address minter) = _resolveRoles(deployer);
        string memory collectionUri = vm.envString("WALLET_RECIPE_CONTRACT_URI");

        vm.startBroadcast(deployerKey);
        nft = _deploy(admin, minter, collectionUri);
        vm.stopBroadcast();

        console.log("WalletRecipeNFT:", address(nft));
        console.log("Name:           ", nft.name());
        console.log("Symbol:         ", nft.symbol());
        console.log("Deployer:       ", deployer);
        console.log("Admin/Owner:    ", admin);
        console.log("Minter:         ", minter);
        console.log("Contract URI:   ", nft.contractURI());
    }

    function _deploy(address admin, address minter, string memory collectionUri) internal returns (WalletRecipeNFT) {
        return new WalletRecipeNFT(NFT_NAME, NFT_SYMBOL, collectionUri, admin, minter);
    }
}
