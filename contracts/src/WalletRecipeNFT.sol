// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * Pond Echoes 的不可升级 ERC-721。
 * origin 终身只可铸造一次；转让不会改变作品来源或恢复资格。
 */
contract WalletRecipeNFT is ERC721URIStorage, ERC721Enumerable, AccessControl, Ownable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    bytes4 private constant _INTERFACE_ID_ERC173 = 0x7f5828d0;
    bytes4 private constant _INTERFACE_ID_ERC7572 = 0xe8a3d485;

    mapping(address => uint256) public tokenIdByOrigin;
    mapping(uint256 => address) public originWalletOf;

    uint256 private _nextTokenId;
    string private _collectionUri;

    event ContractURIUpdated();
    event WalletRecipeMinted(address indexed originWallet, uint256 indexed tokenId);

    error EmptyName();
    error EmptySymbol();
    error EmptyContractURI();
    error EmptyTokenURI();
    error InvalidPermanentURI();
    error ZeroAdmin();
    error ZeroMinter();
    error ZeroOrigin();
    error RolesMustDiffer();
    error OriginAlreadyMinted(address originWallet, uint256 tokenId);

    constructor(string memory name_, string memory symbol_, string memory contractUri_, address admin_, address minter_)
        ERC721(name_, symbol_)
    {
        if (bytes(name_).length == 0) revert EmptyName();
        if (bytes(symbol_).length == 0) revert EmptySymbol();
        if (bytes(contractUri_).length == 0) revert EmptyContractURI();
        _requirePermanentUri(contractUri_);
        if (admin_ == address(0)) revert ZeroAdmin();
        if (minter_ == address(0)) revert ZeroMinter();
        if (admin_ == minter_) revert RolesMustDiffer();

        _collectionUri = contractUri_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, minter_);

        // Ownable 4.9 会先把 owner 设为部署者；构造交易内立即交给独立 admin。
        _transferOwnership(admin_);
    }

    /// metadata 已永久上传后，单交易铸给 origin 并一次写死 tokenURI。
    function mintToOrigin(address originWallet, string calldata tokenUri)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (originWallet == address(0)) revert ZeroOrigin();
        if (bytes(tokenUri).length == 0) revert EmptyTokenURI();
        _requirePermanentUri(tokenUri);

        uint256 existingTokenId = tokenIdByOrigin[originWallet];
        if (existingTokenId != 0) {
            revert OriginAlreadyMinted(originWallet, existingTokenId);
        }

        tokenId = ++_nextTokenId;
        tokenIdByOrigin[originWallet] = tokenId;
        originWalletOf[tokenId] = originWallet;

        _safeMint(originWallet, tokenId);
        _setTokenURI(tokenId, tokenUri);

        emit WalletRecipeMinted(originWallet, tokenId);
    }

    /// ERC-7572 collection metadata；构造后没有修改入口。
    function contractURI() external view returns (string memory) {
        return _collectionUri;
    }

    function _requirePermanentUri(string memory uri) private pure {
        bytes memory value = bytes(uri);
        if (
            value.length != 48 || value[0] != "a" || value[1] != "r" || value[2] != ":"
                || value[3] != "/" || value[4] != "/"
        ) revert InvalidPermanentURI();
        for (uint256 i = 5; i < value.length; ++i) {
            bytes1 char = value[i];
            bool valid = (char >= "A" && char <= "Z") || (char >= "a" && char <= "z")
                || (char >= "0" && char <= "9") || char == "_" || char == "-";
            if (!valid) revert InvalidPermanentURI();
        }
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return interfaceId == _INTERFACE_ID_ERC173 || interfaceId == _INTERFACE_ID_ERC7572
            || super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
}
