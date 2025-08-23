import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/*
  Reads metadata/manifest.json at repo root and batch mints to a recipient
  using YourCollectible.mintBatch(to, string[] uris).

  Usage:
    yarn hardhat run scripts/mintFromManifest.ts --network intuition \
      --to <0xRecipient>

  Notes:
  - Ensure the contract is deployed and named "YourCollectible" in deployments.
  - Ensure manifest.json contains { tokens: [{ tokenId, tokenURI }, ...] }
*/
async function main() {
  const toArgIndex = process.argv.findIndex(a => a === "--to");
  let to = toArgIndex !== -1 ? process.argv[toArgIndex + 1] : undefined;
  if (!to) {
    to = process.env.RECIPIENT;
  }
  if (!to) {
    throw new Error("Missing recipient. Pass --to <address> or set RECIPIENT env var.");
  }

  if (!ethers.isAddress(to)) {
    throw new Error(`Invalid recipient address: ${to}`);
  }

  // scripts/ is at packages/hardhat/scripts, repo root metadata is at ../../../metadata
  const manifestPath = path.resolve(__dirname, "../../../metadata/manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found at ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const uris: string[] = manifest.tokens.map((t: any) => t.tokenURI);
  if (!Array.isArray(uris) || uris.length === 0) {
    throw new Error("No tokenURIs found in manifest.tokens");
  }

  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${await signer.getAddress()}`);

  const yc = await ethers.getContractAt(
    "YourCollectible",
    (await (await import("hardhat")).deployments.get("YourCollectible")).address,
    signer,
  );

  console.log(`Minting ${uris.length} NFTs to ${to}...`);
  const anyYc = yc as any;
  if (typeof anyYc.mintBatch === "function") {
    const tx = await anyYc.mintBatch(to, uris);
    console.log("Submitted batch tx:", tx.hash);
    const receipt = await tx.wait();
    console.log(`Batch minted in block ${receipt?.blockNumber}`);
  } else {
    console.warn("mintBatch() not found on deployed YourCollectible. Falling back to sequential mintItem() calls...");
    for (const [i, uri] of uris.entries()) {
      console.log(`Minting ${i + 1}/${uris.length}: ${uri}`);
      const tx = await anyYc.mintItem(to, uri);
      console.log("Submitted tx:", tx.hash);
      const receipt = await tx.wait();
      console.log(`Minted token in block ${receipt?.blockNumber}`);
    }
    console.log("All tokens minted sequentially.");
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
