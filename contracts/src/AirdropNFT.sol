// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * AirdropNFT — 空投奖励 NFT（ERC-721）
 *
 * 代码复用 ScoreNFT，独立部署独立 tokenId 空间。
 * 语义区分：ScoreNFT 是"用户创作的乐谱"，AirdropNFT 是"运营发放的奖励"。
 * 避免 /score/[tokenId]、/me、stats 的类型混淆。
 */
contract AirdropNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId;

    constructor(
        string memory name_,
        string memory symbol_,
        address minter
    ) ERC721(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, minter);
    }

    /// 铸造空投 NFT，返回自增 tokenId
    function mint(address to) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /// 补写 tokenURI（Arweave metadata 上传后调用）
    function setTokenURI(
        uint256 tokenId,
        string memory uri
    ) external onlyRole(MINTER_ROLE) {
        _requireMinted(tokenId);
        _setTokenURI(tokenId, uri);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
