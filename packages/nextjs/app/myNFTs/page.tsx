"use client";

import Link from "next/link";
import { MyHoldings } from "./_components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

const MyNFTs: NextPage = () => {
  const { isConnected, isConnecting } = useAccount();

  return (
    <section className="min-h-screen flex">
      <div className="container mx-auto px-4 pb-10 flex flex-col grow">
        {/* Page title aligned with Gallery */}
        <div className="mt-10 mb-10 grid grid-cols-1 items-center">
          <h1 className="text-center text-3xl md:text-5xl font-bold">My NFTs</h1>
        </div>

        <div className="flex-1">
          {/* Connect button only when disconnected */}
          <div className="flex justify-center">
            {!isConnected || isConnecting ? <RainbowKitCustomConnectButton /> : null}
          </div>

          {/* Content */}
          <MyHoldings />
        </div>

        {/* Footer navigation (sticky near bottom) */}
        <div className="sticky bottom-4 mt-6 mb-0 flex items-center justify-between">
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
