"use client";

import Link from "next/link";
import { MyHoldings } from "./_components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

const MyNFTs: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  const handleMintItem = async () => {
    // circle back to the zero item if we've reached the end of the array
    if (tokenIdCounter === undefined) return;

    const tokenIdCounterNumber = Number(tokenIdCounter);
    const currentTokenMetaData = nftsMetadata[tokenIdCounterNumber % nftsMetadata.length];
    const notificationId = notification.loading("Uploading to IPFS");
    try {
      const uploadedItem = await addToIPFS(currentTokenMetaData);

      // First remove previous loading notification and then show success notification
      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      await writeContractAsync({
        functionName: "mintItem",
        args: [connectedAddress, uploadedItem.path],
      });
    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
    }
  };

  return (
    <section className="flex items-center justify-center grow pt-14 pb-24 px-6">
      <div className="w-full max-w-6xl flex flex-col">
        <div className="flex-1">
          <div className="flex items-center flex-col">
            <div className="px-5">
              <h1 className="text-center mb-8">
                <span className="block text-4xl font-bold">My NFTs</span>
              </h1>
            </div>
          </div>
          <div className="flex justify-center">
            {!isConnected || isConnecting ? (
              <RainbowKitCustomConnectButton />
            ) : (
              <button className="btn btn-secondary" onClick={handleMintItem}>
                Mint NFT
              </button>
            )}
          </div>
          <MyHoldings />
        </div>

        {/* Flow CTAs - pinned to bottom of page area */}
        <div className="flex justify-between items-center mt-10 mb-2">
          <Link href="/gallery" className="btn btn-ghost">
            ← Back: Gallery
          </Link>
          <Link href="/" className="btn btn-outline">
            Home
          </Link>
        </div>
      </div>
    </section>
  );
};

export default MyNFTs;
