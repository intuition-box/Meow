<h1 align="center">Kitten NFT Gallery</h1>
<p align="center">
  <a href="https://nfts-sepia.vercel.app/"><img src="https://img.shields.io/website?url=https%3A%2F%2Fnfts-sepia.vercel.app&label=Live%20App&logo=vercel" alt="Live App" /></a>
  <a href="https://github.com/ChainsQueenEth/web3dashboard/actions/workflows/ci.yml"><img src="https://github.com/ChainsQueenEth/web3dashboard/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.18.3-339933?logo=node.js&logoColor=white" alt="Node >=20.18.3" />
  <img src="https://img.shields.io/badge/yarn-3.x-2C8EBB?logo=yarn&logoColor=white" alt="Yarn 3.x" />
</p>



<h2 align="center">Contents</h2>
<p align="center">
  <a href="#features-at-a-glance">Features at a Glance</a> ·
  <a href="#ui-showcase">UI Showcase</a> ·
  <a href="#nft-collection-preview">NFT Collection Preview</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#monorepo-structure">Structure</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#common-commands">Commands</a> ·
  <a href="#contract-overview">Contracts</a> ·
  <a href="#deployment-notes">Deploy</a> ·
  <a href="#ipfs-publishing">IPFS</a> ·
  <a href="#troubleshooting">Troubleshooting</a>
</p>



<h2 align="center">Features at a Glance</h2>

> Modern, full‑stack ERC‑721 NFT dApp powered by Hardhat (contracts) and Next.js (UI).

<table align="center" width="100%">
  <tr>
    <td width="50%" valign="top">
      <b>✅ Local chain</b><br/>
      Hardhat dev node for rapid iteration<br/>
      <code>yarn chain</code>
    </td>
    <td width="50%" valign="top">
      <b>🚀 Deployment</b><br/>
      One‑command deploys via hardhat-deploy<br/>
      <code>yarn deploy</code>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <b>🧾 Verification</b><br/>
      Etherscan contract verification<br/>
      <code>yarn verify</code>
    </td>
    <td width="50%" valign="top">
      <b>🌐 IPFS export</b><br/>
      Static export + publish with bgipfs<br/>
      <code>yarn ipfs</code>
    </td>
  </tr>
</table>



 <h2 align="center">UI Showcase</h2>
<p align="center" style="margin: 28px 0 36px;">
  <span style="display:inline-block; width:49%; text-align:center; vertical-align:top;">
    <img src="packages/nextjs/public/img/home_page.png" alt="Home page" width="100%" />
    <br />
    <sub>Welcome screen with wallet connect, featured kittens, and quick links to Gallery and My NFTs.</sub>
  </span>
</p>



<p align="center" style="margin: 28px 0 36px;">
  <span style="display:inline-block; width:49%; text-align:center; vertical-align:top;">
    <img src="packages/nextjs/public/img/gallery_page.png" alt="Gallery page" width="100%" />
    <br />
    <sub>Gallery page with all kittens displayed in a grid layout.</sub>
  </span>
</p>



<p align="center" style="margin: 28px 0 36px;">
  <span style="display:inline-block; width:49%; text-align:center; vertical-align:top;">
    <img src="packages/nextjs/public/img/my_nfts_page.png" alt="My NFTs page" width="100%" />
    <br />
    <sub>My NFTs page with a list of all kittens owned by the user.</sub>
  </span>
</p>


<h2 align="center">NFT Collection Preview</h2>
<p align="center" style="max-width: 720px; margin: 0 auto;">
  <img src="packages/nextjs/public/img/kitten-carousel.gif" alt="Kitten carousel" width="100%" />
  <br />
  <sub>Animated preview of the kitten collection.</sub>
</p>



<h2 align="center">Tech Stack</h2>

<h3 align="center">Core</h3>

| Category   | Tools                                   |
|------------|------------------------------------------|
| Contracts  | Solidity, Hardhat, OpenZeppelin (ERC721) |
| Frontend   | Next.js 15, React 19, Tailwind 4, DaisyUI|
| Web3       | wagmi, viem, RainbowKit                  |
| State/Data | Zustand, TanStack Query                  |

<h3 align="center">Tooling</h3>

| Category | Tools                      |
|----------|-----------------------------|
| Language | TypeScript                  |
| Quality  | ESLint, Prettier            |
| Deploy   | Vercel (optional)           |
| IPFS     | bgipfs                      |



## Monorepo Structure

```mermaid
flowchart TB
  %% Top-down orientation so the diagram grows in height as needed

  subgraph HARDHAT [packages/hardhat/]
    C[contracts/]
    D[deploy/]
    E[deployments/]
    Ei[intuition/]
    El[localhost/]
    S[scripts/]
    T[test/]
  end

  subgraph NEXTJS [packages/nextjs/]
    A[app/]
    CMP[components/]
    SRV[services/]
    CNT[contracts/]
    DC[deployedContracts.ts]
    EC[externalContracts.ts]
    HK[hooks/]
    U[utils/]
    PUB[public/]
  end

  %% Structure inside hardhat
  C --> D
  D --> E
  E --> Ei
  E --> El

  %% How nextjs consumes artifacts
  E -- ABIs & addresses --> DC
  CNT --> DC
  CNT --> EC

  %% App uses contracts config
  DC --> A
  EC --> A
```

Legend:
- __packages/hardhat/__ contracts, deployments, ABIs (`deployments/`).
- __packages/nextjs/__ Next.js dApp UI consuming ABIs/addresses from `packages/nextjs/contracts/`.

## Quick Start

1) Requirements
   - Node >= 20.18.3
   - Yarn 3.x (see `"packageManager": "yarn@3.2.3"`)

2) Install

```bash
yarn install
```

3) Configure envs

- Hardhat: copy `packages/hardhat/.env.example` → `packages/hardhat/.env`
  - Set: `ALCHEMY_API_KEY`, `ETHERSCAN_V2_API_KEY`
  - Deployer key: `yarn account:generate` or `yarn account:import`
- Next.js: copy `packages/nextjs/.env.example` → `packages/nextjs/.env`
  - Fill any required `NEXT_PUBLIC_*` vars

4) Run locally

```bash
# Terminal 1
yarn chain

# Terminal 2
yarn compile && yarn deploy

# Terminal 3
yarn start
# Open http://localhost:3000
```

## Common Commands

- __Contracts__
  - `yarn compile` – Compile contracts
  - `yarn test` – Run tests on Hardhat network
  - `yarn deploy` – Deploy using `hardhat-deploy` (uses deployer key)
  - `yarn verify` – Verify on Etherscan (set `ETHERSCAN_V2_API_KEY`)
  - `yarn hardhat:flatten` – Flatten contracts
  - Accounts utils:
    - `yarn account` – List account(s)
    - `yarn account:generate` – Generate deployer
    - `yarn account:import` – Import private key
    - `yarn account:reveal-pk` – Reveal stored PK

- __Frontend__
  - `yarn start` – Next.js dev
  - `yarn next:build` / `yarn next:serve` – Build/serve
  - `yarn ipfs` – Static export + upload to IPFS via bgipfs

- __Quality__
  - `yarn lint` – Lint (frontend + contracts)
  - `yarn format` – Prettier format

## Contract Overview

[YourCollectible.sol](packages/hardhat/contracts/YourCollectible.sol) (ERC721, Enumerable, URI Storage, Ownable):
- `mintItem(address to, string uri)` – Mints a token with a full tokenURI.
- `mintBatch(address to, string[] uris)` – Batch mint multiple URIs.
- Emits `Minted(tokenId, to, uri)`.
- Token IDs auto-increment via `tokenIdCounter`.

You can host your metadata JSON (e.g., in `metadata/`) and images (e.g., `img/`) on IPFS and use their IPFS URIs when minting.

## Deployment Notes

- Networks and RPC keys are configured in [packages/hardhat/hardhat.config.ts](packages/hardhat/hardhat.config.ts) and [.env](packages/hardhat/.env).
- Deployed addresses and ABIs are stored in `packages/hardhat/deployments/` for consumption by the frontend.
- For Etherscan verification: ensure contracts are flattened/configured or use `yarn verify` with correct constructor args.

## IPFS Publishing

- `yarn ipfs` will:
  - Build the Next.js app (static export)
  - Upload to IPFS via `bgipfs`, then print the resulting CID and gateway URL

## Troubleshooting

- Ensure Node and Yarn versions match repo engines.
- If contracts/types are stale: `yarn hardhat:clean && yarn compile`.
- If wallet connection fails in UI, check the configured chain and RPC in Next.js [.env](packages/nextjs/.env).