"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
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

const GalleryPage = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const { data: yourCollectibleContract } = useScaffoldContract({ contractName: "YourCollectible" });
  const publicClient = usePublicClient();
  const loadedForAddressRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const ignoreCacheRef = useRef(false);

  // Static token URIs available for minting (from metadata/manifest.json)
  const TOKEN_URIS: string[] = [
    "https://bafybeid23csx6zqebrw4qlkq4lkc4lz4tuk3xtt7jsp7i3gkl4bl5g4nx4.ipfs.w3s.link/image-kitten-01.json",
    "https://bafybeibdbqusjudzq2254znouotv4fqxodiye5vqp57ulhe5skuiselvuu.ipfs.w3s.link/image-kitten-02.json",
    "https://bafybeiem2ypnqmmuhkzpxa555bzv3vw7x7g53q2i3mhqmnvw7nuaeeev4a.ipfs.w3s.link/image-kitten-03.json",
    "https://bafybeiahaisrbsdlvkcxdtzaya4pc4p2sxd6e6czfvn5k4b6ypbuglc6ri.ipfs.w3s.link/image-kitten-04.json",
    "https://bafybeiey4wcignlnfyietlqp732opz27jm4f3hny2btyekufdmdrs454ke.ipfs.w3s.link/image-kitten-05.json",
    "https://bafybeiapkbf5idi4we45jahvfzqk5v2h7aggandajyw5wzj4w6js4mwzmi.ipfs.w3s.link/image-kitten-06.json",
    "https://bafybeifyg7vk5fl2ljlpski6fppof6lqzexwsnnlq47yakxwpirrelqvxm.ipfs.w3s.link/image-kitten-07.json",
    "https://bafybeig3wma23unyyo77cjz4zk6dewkraqseaycxbvmhu5y2trwewaipfq.ipfs.w3s.link/image-kitten-08.json",
    "https://bafybeigh6kr3iuil5fh62bovp3byn3jbf2vgs7mrumb442ihu5mv3ftsoi.ipfs.w3s.link/image-kitten-09.json",
    "https://bafybeibm3ra626vruqamsuiubsl7gr4yto5wquogagd7zpxt34s55bbs7e.ipfs.w3s.link/image-kitten-10.json",
    "https://bafybeib3ytqqi2k4z3bkozywgjh32vsizkw3hjgnebkwa4tgadl3v5sxfy.ipfs.w3s.link/image-kitten-11.json",
    "https://bafybeig46duegh3rund26vucqfk2vmjekho2k7hihtatjkcw4epnli6nbi.ipfs.w3s.link/image-kitten-12.json",
  ];
  const usedUris = new Set(items.map(i => i.uri));
  const nextMintUri = TOKEN_URIS.find(u => !usedUris.has(u));

  const { address } = useAccount();
  // Write: mintItem
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

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
          setPagesLoaded(1);
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
            <div className="my-6 max-w-md mx-auto">
              <NFTCard
                id={0}
                name="Mint your first Kitten"
                imageUrl=""
                description="No kittens yet. Mint the first one!"
                ctaPrimary={{
                  label: minting ? "Minting…" : nextMintUri ? "Mint" : "Sold out",
                  onClick: async () => {
                    try {
                      if (!address) throw new Error("Connect wallet");
                      const to = address; // already typed as `0x${string}` from useAccount
                      if (!nextMintUri) throw new Error("Sold out");
                      const mintUri: string = nextMintUri;
                      setMinting(true);
                      const hash = (await writeContractAsync({
                        functionName: "mintItem",
                        args: [to, mintUri],
                      } as any)) as `0x${string}`;
                      notification.info("Mint submitted. Waiting for confirmation…");
                      if (!publicClient) throw new Error("No public client");
                      await publicClient.waitForTransactionReceipt({ hash });
                      notification.success("Mint confirmed! Refreshing…");
                      ignoreCacheRef.current = true;
                      loadedForAddressRef.current = null;
                      setTimeout(() => {
                        setMinting(false);
                        setLoading(true);
                      }, 800);
                    } catch (e: any) {
                      console.error(e);
                      notification.error(e?.shortMessage || e?.message || "Mint failed");
                      setMinting(false);
                    }
                  },
                  disabled: minting || !address || !nextMintUri,
                }}
              />
            </div>
          )
        ) : (
          <>
            {minting && (
              <div className="flex justify-center items-center my-2">
                <span className="loading loading-spinner loading-sm" aria-label="Minting" />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 my-6 items-stretch mx-auto">
              {items.slice(0, pagesLoaded * 12).map(nft => (
                <NFTCard
                  key={nft.id}
                  id={nft.id}
                  name={nft.name || `Token #${nft.id}`}
                  imageUrl={nft.image || ""}
                  description={nft.description || ""}
                  owner={nft.owner || undefined}
                  mediaAspect="1:1"
                  ctaPrimary={!nextMintUri ? { label: "Sold out", disabled: true, onClick: () => {} } : undefined}
                />
              ))}
            </div>
            {items.length > pagesLoaded * 12 && (
              <div className="flex justify-center mt-4">
                <button className="btn btn-outline" onClick={() => setPagesLoaded(p => p + 1)}>
                  Load more
                </button>
              </div>
            )}
          </>
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
