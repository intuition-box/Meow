"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { NFTCard } from "~~/partials/nft/nft-card";
import { notification } from "~~/utils/scaffold-eth";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

export const MyHoldings = () => {
  const { address: connectedAddress } = useAccount();
  const [myAllCollectibles, setMyAllCollectibles] = useState<Collectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);
  const [transferringId, setTransferringId] = useState<number | null>(null);
  const [transferAddr, setTransferAddr] = useState<Record<number, string>>({});

  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  const { data: myTotalBalance } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "balanceOf",
    args: [connectedAddress],
    watch: true,
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

  useEffect(() => {
    const updateMyCollectibles = async (): Promise<void> => {
      if (myTotalBalance === undefined || yourCollectibleContract === undefined || connectedAddress === undefined)
        return;

      setAllCollectiblesLoading(true);
      const collectibleUpdate: Collectible[] = [];
      const totalBalance = parseInt(myTotalBalance.toString());
      for (let tokenIndex = 0; tokenIndex < totalBalance; tokenIndex++) {
        try {
          const tokenId = await yourCollectibleContract.read.tokenOfOwnerByIndex([
            connectedAddress,
            BigInt(tokenIndex),
          ]);

          const tokenURI = await yourCollectibleContract.read.tokenURI([tokenId]);
          // Resolve tokenURI to a fetchable URL
          const resolvedTokenUri = tokenURI.startsWith("ipfs://")
            ? `https://ipfs.io/ipfs/${tokenURI.replace("ipfs://", "")}`
            : tokenURI;

          // Fetch metadata JSON directly from resolved URL
          const nftMetadata: NFTMetaData = await fetch(resolvedTokenUri).then(res => res.json());

          // Normalize image to https if it's ipfs:// for browser rendering
          if (nftMetadata?.image?.startsWith && nftMetadata.image.startsWith("ipfs://")) {
            nftMetadata.image = `https://ipfs.io/ipfs/${nftMetadata.image.replace("ipfs://", "")}`;
          }

          collectibleUpdate.push({
            id: parseInt(tokenId.toString()),
            uri: tokenURI,
            owner: connectedAddress,
            ...nftMetadata,
          });
        } catch (e) {
          notification.error("Error fetching all collectibles");
          setAllCollectiblesLoading(false);
          console.log(e);
        }
      }
      collectibleUpdate.sort((a, b) => a.id - b.id);
      setMyAllCollectibles(collectibleUpdate);
      setAllCollectiblesLoading(false);
    };

    updateMyCollectibles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress, myTotalBalance]);

  const transferToken = async (tokenId: number) => {
    try {
      if (!connectedAddress) {
        notification.error("Connect your wallet to transfer");
        return;
      }
      const to = (transferAddr[tokenId] || "").trim();
      if (!to) {
        notification.error("Enter a recipient address");
        return;
      }
      if (!to.startsWith("0x") || to.length !== 42) {
        notification.error("Invalid address");
        return;
      }
      setTransferringId(tokenId);
      await writeContractAsync({
        functionName: "safeTransferFrom",
        args: [connectedAddress as `0x${string}`, to as `0x${string}`, BigInt(tokenId)],
        account: connectedAddress as `0x${string}`,
        chainId: 13579,
      } as any);
      notification.success("Transfer submitted");
    } catch (e: any) {
      console.error(e);
      notification.error(e?.shortMessage || e?.message || "Transfer failed");
    } finally {
      setTransferringId(null);
    }
  };

  if (allCollectiblesLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <>
      {myAllCollectibles.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-neutral-700 dark:text-neutral-200">No NFTs found</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 my-6 items-stretch mx-auto">
          {myAllCollectibles.map(item => (
            <NFTCard
              key={item.id}
              id={item.id}
              name={item.name || `Token #${item.id}`}
              imageUrl={item.image || ""}
              description={(item.description || "").slice(0, 90)}
              owner={item.owner}
              mediaAspect="1:1"
              size="sm"
              aboveCta={
                <div className="w-full flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="0x recipient address"
                    className="input input-bordered input-sm w-full"
                    value={transferAddr[item.id] || ""}
                    onChange={e => setTransferAddr(prev => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              }
              ctaPrimary={{
                label: "Transfer",
                loading: transferringId === item.id,
                onClick: () => transferToken(item.id),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};
