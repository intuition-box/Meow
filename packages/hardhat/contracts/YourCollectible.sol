// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract YourCollectible is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 public tokenIdCounter;
    
    // Emitted for each minted token
    event Minted(uint256 indexed tokenId, address indexed to, string uri);

    constructor() ERC721("YourCollectible", "YCB") Ownable(msg.sender) {}

    function _baseURI() internal pure override returns (string memory) {
        return "";
    }

    function mintItem(address to, string memory uri) public returns (uint256) {
        tokenIdCounter++;
        uint256 tokenId = tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit Minted(tokenId, to, uri);
        return tokenId;
    }

    // Batch mint multiple tokenURIs in a single transaction
    function mintBatch(address to, string[] memory uris) public returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](uris.length);
        for (uint256 i = 0; i < uris.length; i++) {
            tokenIds[i] = mintItem(to, uris[i]);
        }
        return tokenIds;
    }

    // Override functions from OpenZeppelin ERC721, ERC721Enumerable and ERC721URIStorage

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
