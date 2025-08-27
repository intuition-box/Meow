// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract YourCollectible is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    using Strings for uint256;

    uint256 public tokenIdCounter;
    uint256 public mintPrice; // in wei
    bool public saleActive;
    string public baseTokenURI; // e.g., ipfs://CID/

    // Emitted for each minted token
    event Minted(uint256 indexed tokenId, address indexed to, string uri);

    constructor() ERC721("YourCollectible", "YCB") Ownable(msg.sender) {
        // Defaults can be changed by owner later
        mintPrice = 0.01 ether;
        saleActive = true;
    }

    /**
     * Owner configuration
     */
    function setMintPrice(uint256 newPriceWei) external onlyOwner {
        mintPrice = newPriceWei;
    }

    function setSaleActive(bool active) external onlyOwner {
        saleActive = active;
    }

    function setBaseTokenURI(string calldata newBase) external onlyOwner {
        baseTokenURI = newBase;
    }

    function withdraw(address payable to) external onlyOwner {
        require(to != address(0), "bad to");
        to.transfer(address(this).balance);
    }

    /**
     * Public paid mint - mints next token to buyer.
     * tokenURI will be baseTokenURI + tokenId + ".json" if baseTokenURI is set.
     */
    function mintKitten() external payable returns (uint256) {
        require(saleActive, "sale off");
        require(msg.value >= mintPrice, "insufficient value");

        tokenIdCounter++;
        uint256 tokenId = tokenIdCounter;
        _safeMint(msg.sender, tokenId);

        string memory uri = "";
        if (bytes(baseTokenURI).length > 0) {
            uri = string.concat(baseTokenURI, tokenId.toString(), ".json");
            _setTokenURI(tokenId, uri);
        }
        emit Minted(tokenId, msg.sender, uri);
        return tokenId;
    }

    /**
     * Existing helper to mint to any address with explicit URI
     */
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
        // If explicitly set via URIStorage, that takes precedence
        string memory stored = super.tokenURI(tokenId);
        if (bytes(stored).length != 0) {
            return stored;
        }
        // Else, if base set, compose base + tokenId + .json
        if (bytes(baseTokenURI).length > 0) {
            return string.concat(baseTokenURI, tokenId.toString(), ".json");
        }
        return "";
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
