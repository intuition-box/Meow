"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { NFTCard } from "~~/partials/nft/nft-card";
import { notification } from "~~/utils/scaffold-eth";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface GalleryItem extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

const resolveToHttp = (uri: string) =>
  uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}` : uri;

const fetchJsonWithTimeout = async (url: string, timeoutMs = 8000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as NFTMetaData;
  } finally {
    clearTimeout(id);
  }
};

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length) as any;
  let i = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const current = i++;
      if (current >= items.length) break;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

const withTimeout = async <T,>(p: Promise<T>, ms = 10000, label = "operation") => {
  let t: any;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
};

const GalleryPage: NextPage = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedCache, setUsedCache] = useState(false);
  const [minting, setMinting] = useState(false);

  const { data: yourCollectibleContract } = useScaffoldContract({ contractName: "YourCollectible" });
  const loadedForAddressRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const ignoreCacheRef = useRef(false);

  // Read sale status and price
  const { data: saleActive } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "saleActive" as any,
  } as any);
  const { data: mintPrice } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "mintPrice" as any,
  } as any);

  // Write: mintKitten
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

  const readCache = (addr: string) => {
    try {
      const raw = localStorage.getItem(`gallery:${addr}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts: number; items: GalleryItem[] };
      const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
      return parsed.items || null;
    } catch {
      return null;
    }
  };

  const writeCache = (addr: string, data: GalleryItem[]) => {
    try {
      localStorage.setItem(`gallery:${addr}`, JSON.stringify({ ts: Date.now(), items: data }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      if (!yourCollectibleContract) return;
      const contractAddress = (yourCollectibleContract as any).address as string | undefined;
      if (contractAddress && loadedForAddressRef.current === contractAddress) return; // already loaded for this address
      if (loadingRef.current) return; // avoid concurrent loads
      loadingRef.current = true;
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        // Try cache first (unless refresh requested)
        if (contractAddress && !ignoreCacheRef.current) {
          const cached = readCache(contractAddress);
          if (cached) {
            if (isMounted) {
              setItems(cached);
              setUsedCache(true);
            }
          }
        }

        let supply = 0;
        try {
          const supplyBn = await yourCollectibleContract.read.totalSupply();
          supply = Number(await withTimeout(Promise.resolve(supplyBn), 10000, "totalSupply()"));
        } catch {
          // Contracts without ERC721Enumerable won't have totalSupply(); keep supply = 0 and try fallbacks below
          supply = 0;
        }

        // Load with controlled concurrency (pool size = 6)
        const indices = Array.from({ length: supply }, (_, i) => i);
        const mapped = await mapWithConcurrency(indices, 6, async i => {
          try {
            let tokenId: bigint | null = null;
            // Primary: ERC721Enumerable
            try {
              tokenId = await yourCollectibleContract.read.tokenByIndex([BigInt(i)]);
            } catch {
              // Fallback A: assume 0-based sequential IDs
              try {
                await yourCollectibleContract.read.ownerOf([BigInt(i)]);
                tokenId = BigInt(i);
                console.debug("gallery: fallback 0-based tokenId", tokenId);
              } catch {
                // Fallback B: assume 1-based sequential IDs
                tokenId = BigInt(i + 1);
                console.debug("gallery: fallback 1-based tokenId", tokenId);
              }
            }

            const [tokenURI, owner] = await Promise.all([
              yourCollectibleContract.read.tokenURI([tokenId!]),
              yourCollectibleContract.read.ownerOf([tokenId!]),
            ]);
            const resolved = resolveToHttp(tokenURI);
            console.debug("Gallery: token", { tokenId: Number(tokenId), tokenURI, resolved });
            let meta: NFTMetaData | undefined;
            try {
              meta = await fetchJsonWithTimeout(resolved, 8000);
              console.debug("Gallery: metadata fetched", { tokenId: Number(tokenId) });
            } catch (e) {
              console.warn("Gallery: metadata fetch failed", {
                tokenId: Number(tokenId),
                url: resolved,
                error: String(e),
              });
              meta = { name: `Token #${Number(tokenId)}`, description: "Metadata unavailable", image: "" } as any;
            }
            if (meta?.image?.startsWith && meta.image.startsWith("ipfs://")) {
              meta.image = resolveToHttp(meta.image);
            }
            return { id: Number(tokenId), uri: tokenURI, owner, ...meta } as GalleryItem;
          } catch (e) {
            console.error("Gallery token load failed", e);
            return null as unknown as GalleryItem;
          }
        });

        let fetched: GalleryItem[] = mapped.filter(Boolean).sort((a, b) => a!.id - b!.id);

        // Fallback discovery when no Enumerable and supply read is 0
        if (supply === 0 && fetched.length === 0) {
          const discover = async (base: 0 | 1) => {
            const maxProbe = 50; // reasonable cap
            const probeIdx = Array.from({ length: maxProbe }, (_, i) => i + base);
            const results = await mapWithConcurrency(probeIdx, 6, async id => {
              try {
                const tokenId = BigInt(id);
                const [owner, tokenURI] = await Promise.all([
                  yourCollectibleContract.read.ownerOf([tokenId]),
                  yourCollectibleContract.read.tokenURI([tokenId]),
                ]);
                const resolved = resolveToHttp(tokenURI);
                let meta: NFTMetaData | undefined;
                try {
                  meta = await fetchJsonWithTimeout(resolved, 8000);
                  console.debug("Gallery: metadata fetched (fallback)", { tokenId: id });
                } catch {
                  console.warn("Gallery: metadata fetch failed (fallback)", { tokenId: id, url: resolved });
                  meta = { name: `Token #${id}`, description: "Metadata unavailable", image: "" } as any;
                }
                if (meta?.image?.startsWith && meta.image.startsWith("ipfs://")) {
                  meta.image = resolveToHttp(meta.image);
                }
                return { id, uri: tokenURI, owner, ...meta } as GalleryItem;
              } catch {
                return null as unknown as GalleryItem;
              }
            });
            return results.filter(Boolean) as GalleryItem[];
          };

          const zeroBased = await discover(0);
          const oneBased = await discover(1);
          const combined = [...zeroBased, ...oneBased].reduce((map, item) => {
            map.set(item.id, item);
            return map;
          }, new Map<number, GalleryItem>());
          fetched = Array.from(combined.values()).sort((a, b) => a.id - b.id);
        }

        if (isMounted) setItems(fetched);
        if (contractAddress) loadedForAddressRef.current = contractAddress;
        if (contractAddress) writeCache(contractAddress, fetched);
        ignoreCacheRef.current = false; // reset
      } catch (err: any) {
        console.error(err);
        const msg = err?.message?.includes("timed out")
          ? "Network slow or wrong chain. Check you are on Intuition (13579) and RPC is reachable."
          : "Error loading gallery";
        setError(msg);
        notification.error("Error loading gallery");
      } finally {
        if (isMounted) setLoading(false);
        loadingRef.current = false;
      }
    };
    loadAll();
    return () => {
      isMounted = false;
    };
  }, [yourCollectibleContract]);

  return (
    <section className="flex items-center justify-center grow pt-14 pb-24 px-6">
      <div className="w-full max-w-6xl flex flex-col">
        <h1 className="text-center mb-8">
          <span className="block text-4xl font-bold">Gallery</span>
        </h1>
        {/* Mint CTA */}
        {/* Global mint button and sale status removed per request; mint via per-card buttons */}
        <div className="flex-1">
          {!yourCollectibleContract ? (
            <div className="flex justify-center items-center mt-10">
              <div className="text-2xl">Connecting to contract… Ensure you are on Intuition (13579).</div>
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center mt-10">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center mt-10">
              <div className="text-2xl text-error">{error}</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex justify-center items-center mt-10">
              <div className="text-2xl text-primary-content">No NFTs found</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 my-6 items-stretch mx-auto">
              {items.map(nft => (
                <NFTCard
                  key={nft.id}
                  id={nft.id}
                  name={nft.name ?? `Token #${nft.id}`}
                  imageUrl={nft.image ?? ""}
                  description={nft.description}
                  owner={nft.owner}
                  priceEth={mintPrice != null ? formatEther(BigInt(mintPrice as any)) : undefined}
                  priceUnit="TTRUST"
                  ctaPrimary={{
                    label: mintPrice != null ? `Mint for ${formatEther(BigInt(mintPrice as any))} TTRUST` : "Mint",
                    onClick: async () => {
                      try {
                        if (mintPrice == null) return;
                        setMinting(true);
                        await writeContractAsync(
                          {
                            functionName: "mintKitten" as any,
                            args: [] as any,
                            value: mintPrice as unknown as bigint,
                          } as any,
                          {
                            blockConfirmations: 1,
                            onBlockConfirmation: () => {
                              // Force refresh after mint
                              ignoreCacheRef.current = true;
                              loadedForAddressRef.current = null;
                              setLoading(true);
                              setTimeout(() => setLoading(false), 0);
                            },
                          },
                        );
                        notification.success("Minted a new kitten!");
                      } catch (e: any) {
                        notification.error(e?.shortMessage || e?.message || "Mint failed");
                      } finally {
                        setMinting(false);
                      }
                    },
                    disabled: !saleActive || minting || mintPrice == null,
                  }}
                  mediaAspect="3:4"
                />
              ))}
            </div>
          )}

          {/* Refresh and cache status */}
          <div className="flex justify-center mt-6">
            <button
              className="btn btn-sm"
              onClick={() => {
                ignoreCacheRef.current = true; // next load bypasses cache
                // reset loaded address so we can force reload
                loadedForAddressRef.current = null;
                // trigger effect by toggling loading via a microtask
                setLoading(true);
                setTimeout(() => setLoading(false), 0);
              }}
            >
              Refresh gallery
            </button>
            {usedCache && <span className="ml-3 text-sm opacity-60">Loaded from cache</span>}
          </div>
        </div>

        {/* Flow CTAs - pinned to bottom of page area */}
        <div className="flex justify-between items-center mt-10 mb-2">
          <Link href="/" className="btn btn-ghost">
            ← Back: Home
          </Link>
          <Link href="/myNFTs" className="btn btn-ghost">
            Next: My NFTs →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default GalleryPage;
