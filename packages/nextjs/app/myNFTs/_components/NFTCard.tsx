"use client";

import { useState } from "react";
import { Collectible } from "./MyHoldings";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { NFTCard as ReusableNFTCard } from "~~/partials/nft/nft-card";

export const NFTCard = ({ nft }: { nft: Collectible }) => {
  const [transferToAddress, setTransferToAddress] = useState("");

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

  return (
    <div className="w-full max-w-[360px]">
      <ReusableNFTCard
        id={nft.id}
        name={nft.name ?? `Token #${nft.id}`}
        imageUrl={nft.image ?? ""}
        description={nft.description}
        owner={nft.owner}
        mediaAspect="1:1"
      />

      {/* Transfer controls */}
      <div className="mt-3 rounded-xl border border-white/10 bg-neutral-900/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-200">Owner:</span>
          <Address address={nft.owner} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-neutral-300" htmlFor={`transfer-to-${nft.id}`}>
            Transfer To
          </label>
          <AddressInput
            value={transferToAddress}
            placeholder="receiver address"
            onChange={newValue => setTransferToAddress(newValue)}
          />
        </div>
        <div className="flex justify-end">
          <button
            className="btn btn-secondary btn-md px-8 tracking-wide"
            onClick={() => {
              try {
                writeContractAsync({
                  functionName: "transferFrom",
                  args: [nft.owner, transferToAddress, BigInt(nft.id.toString())],
                });
              } catch (err) {
                console.error("Error calling transferFrom function", err);
              }
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
