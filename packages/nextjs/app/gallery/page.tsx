"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { NFTCard } from "~~/partials/nft/nft-card";
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

const GalleryPage = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const { data: yourCollectibleContract } = useScaffoldContract({ contractName: "YourCollectible" });
  const loadedForAddressRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const ignoreCacheRef = useRef(false);

  const readCache = (addr: string) => {
    try {
      const raw = localStorage.getItem(`gallery:${addr}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts: number; items: GalleryItem[] };
      const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
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
                // debug: fallback 0-based tokenId
              } catch {
                // Fallback B: assume 1-based sequential IDs
                tokenId = BigInt(i + 1);
                // debug: fallback 1-based tokenId
              }
            }

            const [tokenURI, owner] = await Promise.all([
              yourCollectibleContract.read.tokenURI([tokenId!]),
              yourCollectibleContract.read.ownerOf([tokenId!]),
            ]);
            const resolved = resolveToHttp(tokenURI);
            let meta: NFTMetaData | undefined;
            try {
              meta = await fetchJsonWithTimeout(resolved, 8000);
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
          const combinedMap = [...zeroBased, ...oneBased].reduce((map, item) => {
            map.set(item.id, item);
            return map;
          }, new Map<number, GalleryItem>());
          fetched = Array.from(combinedMap.values()).sort((a, b) => a.id - b.id);
        }

        // Update state and cache
        if (isMounted) {
          setItems(fetched);
        }
        if (contractAddress) loadedForAddressRef.current = contractAddress;
        if (contractAddress) writeCache(contractAddress, fetched);
        ignoreCacheRef.current = false;
      } catch (e: any) {
        console.error(e);
        if (isMounted) setError(e?.message || "Failed to load gallery");
      } finally {
        loadingRef.current = false;
        if (isMounted) {
          setLoading(false);
          setLoadedOnce(true);
        }
      }
    };

    withTimeout(loadAll(), 20000, "load gallery");
    return () => {
      isMounted = false;
    };
  }, [yourCollectibleContract]);

  // Render
  return (
    <section className="min-h-screen">
      <div className="container mx-auto px-4">
        <div className="mt-10 mb-10 grid grid-cols-1 items-center">
          <h1 className="text-center text-3xl md:text-5xl font-bold">Gallery</h1>
        </div>

        {error && (
          <div className="alert alert-error my-4">
            <span>{error}</span>
          </div>
        )}

        {items.length === 0 ? (
          loading || ignoreCacheRef.current || !loadedOnce ? (
            <div className="flex justify-center my-10">
              <span className="loading loading-spinner" />
            </div>
          ) : (
            <div className="my-10 text-center text-neutral-700 dark:text-neutral-200">
              <p>No NFTs found in this collection.</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 my-6 items-stretch mx-auto">
            {(() => {
              const visible = items.slice(0, 12);
              const soldOut = items.length >= 12;
              return visible.map(nft => (
                <NFTCard
                  key={nft.id}
                  id={nft.id}
                  name={nft.name || `Token #${nft.id}`}
                  imageUrl={nft.image || ""}
                  description={nft.description || ""}
                  owner={nft.owner || undefined}
                  mediaAspect="1:1"
                  ctaPrimary={soldOut ? { label: "Sold out", disabled: true, onClick: () => {} } : undefined}
                />
              ));
            })()}
          </div>
        )}

        {/* Refresh status only when active */}
        {ignoreCacheRef.current && (
          <div className="mt-8 flex items-center justify-start text-xs text-neutral-500">
            <span>Refreshing…</span>
          </div>
        )}

        {/* Footer navigation */}
        <div className="mt-6 mb-10 flex items-center justify-between">
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
