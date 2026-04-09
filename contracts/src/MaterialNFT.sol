// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * MaterialNFT — 音乐素材 NFT（ERC-1155）
 *
 * 权限模型：
 * - MINTER_ROLE：可以调 mint（运营钱包）
 * - DEFAULT_ADMIN_ROLE：可以管理角色 + 更新 URI（deployer）
 *
 * 每个 tokenId 对应一首曲子，amount 代表铸造份数。
 */
contract MaterialNFT is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(string memory uri_, address minter) ERC1155(uri_) {
        // deployer 拿到管理员角色（管理角色 + 更新 URI）
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // 运营钱包拿到铸造角色
        _grantRole(MINTER_ROLE, minter);
    }

    /// 只有 MINTER_ROLE 能调
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, id, amount, data);
    }

    /// 管理员可更新 metadata URI（Phase 2 换成 Arweave 地址）
    function setURI(string memory newUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newUri);
    }

    /// ERC1155 和 AccessControl 都实现了 supportsInterface，需要手动合并
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
