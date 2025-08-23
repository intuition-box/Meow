import { ethers, deployments } from "hardhat";

async function main() {
  const { address } = await deployments.get("YourCollectible");
  const yc = await ethers.getContractAt("YourCollectible", address);

  console.log("Contract:", address);

  // totalSupply from ERC721Enumerable
  const total = await (yc as any).totalSupply();
  console.log("totalSupply:", total.toString());

  // Print first 5 tokenIds (or all if <= 12)
  const max = Math.min(12, Number(total));
  for (let i = 1; i <= max; i++) {
    try {
      const owner = await yc.ownerOf(i);
      const uri = await yc.tokenURI(i);
      console.log(`#${i} owner:`, owner);
      console.log(`#${i} tokenURI:`, uri);
    } catch {
      console.log(`#${i} not minted yet`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
