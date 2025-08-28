"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IPFS_GATEWAYS, nextIpfsGatewayUrl, resolveToHttp, withImageFallback } from "./ipfs-utils";
import { cardVariants, computeTilt, motionProps, sheenVariants } from "./nft-card.motion";
import { NFTCardProps } from "./nft-card.types";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink } from "lucide-react";

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function shortenAddress(addr?: string, left = 6, right = 4) {
  if (!addr) return "";
  if (addr.length <= left + right + 2) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

const aspectClass = (aspect?: NFTCardProps["mediaAspect"]) => {
  switch (aspect) {
    case "3:4":
      return "aspect-[3/4]";
    case "16:9":
      return "aspect-video";
    default:
      return "aspect-square";
  }
};

const sizeClass = (size: NonNullable<NFTCardProps["size"]> = "md") => {
  switch (size) {
    case "sm":
      return { title: "text-sm", text: "text-xs", pad: "p-3", btn: "h-8 px-3 text-xs" };
    case "lg":
      return { title: "text-xl", text: "text-sm", pad: "p-5", btn: "h-10 px-5 text-sm" };
    default:
      return { title: "text-base md:text-lg", text: "text-sm", pad: "p-4", btn: "h-9 px-4 text-sm" };
  }
};

export function NFTCard(props: NFTCardProps) {
  const {
    id,
    name,
    imageUrl,
    description,
    owner,
    priceAmount,
    priceUnit,
    badgeText,
    mediaAspect = "1:1",
    href,
    onClick,
    ctaPrimary,
    ctaSecondary,
    size = "md",
    selectable,
    selected,
    className,
  } = props;

  const reduceMotion = useReducedMotion();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const sizes = sizeClass(size);

  const resolvedImage = useMemo(() => withImageFallback(resolveToHttp(imageUrl)), [imageUrl]);
  const [imageSrc, setImageSrc] = useState(resolvedImage);
  const watchdogRef = useRef<number | null>(null);
  const hadEventRef = useRef(false);
  const attemptsRef = useRef(0);
  const MAX_ATTEMPTS = IPFS_GATEWAYS.length;
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setImageSrc(resolvedImage);
    setIsLoading(true);
    console.debug("NFTCard: resolved image URL", { id, resolvedImage });
  }, [resolvedImage, id]);

  // Watchdog: if no load/error within timeout, rotate gateway
  useEffect(() => {
    hadEventRef.current = false;
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    watchdogRef.current = window.setTimeout(() => {
      if (hadEventRef.current) return;
      const next = nextIpfsGatewayUrl(imageSrc);
      console.warn("NFTCard: watchdog rotating gateway (no events)", {
        id,
        current: imageSrc,
        next,
        attempts: attemptsRef.current,
      });
      if (next && attemptsRef.current < MAX_ATTEMPTS) {
        attemptsRef.current += 1;
        setImageSrc(next);
      } else {
        console.error("NFTCard: watchdog exhausted gateways, using placeholder", { id });
        setImageSrc(withImageFallback(""));
        setIsLoading(false);
      }
    }, 4000);
    return () => {
      if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    };
  }, [imageSrc, id, MAX_ATTEMPTS]);

  const CardInner = (
    <motion.div
      className={clsx(
        "group relative rounded-xl border border-white/5 bg-neutral-900/60 backdrop-blur-sm",
        "shadow-[0_10px_20px_-10px_rgba(0,0,0,0.35)] transition-all duration-200",
        "overflow-hidden focus:outline-none hover:shadow-[0_18px_28px_-12px_rgba(0,0,0,0.5)] hover:-translate-y-0.5",
        selectable && selected && "ring-2 ring-indigo-500",
        className,
      )}
      onMouseMove={e => !reduceMotion && setTilt(computeTilt(e, 12))}
      variants={cardVariants}
      custom={tilt}
      {...(!reduceMotion ? motionProps : {})}
    >
      {/* Sheen */}
      {!reduceMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          variants={sheenVariants}
        />
      )}

      {/* Media */}
      <figure className={clsx("relative w-full overflow-hidden rounded-lg bg-white", aspectClass(mediaAspect))}>
        {/* Skeleton while loading */}
        {isLoading && <div className="absolute inset-0 animate-pulse bg-neutral-100" aria-hidden="true" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={name || `NFT #${id}`}
          className={clsx(
            "absolute inset-0 h-full w-full object-contain object-center select-none",
            "transition-opacity duration-500",
            isLoading ? "opacity-0" : "opacity-100",
          )}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onLoad={() => {
            console.debug("NFTCard: image loaded", { id, src: imageSrc });
            hadEventRef.current = true;
            if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
            setIsLoading(false);
          }}
          onError={() => {
            const next = nextIpfsGatewayUrl(imageSrc);
            console.warn("NFTCard: image failed, rotating gateway", { id, failed: imageSrc, next });
            hadEventRef.current = true;
            if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
            if (next) {
              attemptsRef.current += 1;
              setIsLoading(true);
              setImageSrc(next);
            } else {
              console.error("NFTCard: all gateways failed, using placeholder", { id });
              setImageSrc(withImageFallback(""));
              setIsLoading(false);
            }
          }}
        />
        {badgeText && (
          <figcaption className="absolute left-3 top-3 rounded-md border border-white/10 bg-neutral-900/70 px-2 py-1 text-xs text-neutral-200 backdrop-blur">
            {badgeText}
          </figcaption>
        )}
        <figcaption className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200 backdrop-blur">
          #{id}
        </figcaption>
      </figure>

      {/* Body */}
      <div
        className={clsx(
          "space-y-3 border-t",
          /* subtle surface that adapts to theme */
          "bg-base-100/60 dark:bg-[#818cf8]/10 border-[#818cf8]/30",
          "rounded-b-xl",
          sizes.pad,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className={clsx("font-semibold tracking-[-0.01em] text-neutral-100", sizes.title)} title={name}>
            <span className="line-clamp-2 leading-snug">{name}</span>
          </h3>
          {href && (
            <Tooltip.Provider delayDuration={150}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 transition-colors hover:text-white"
                    aria-label="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    sideOffset={6}
                    className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 shadow-xl"
                  >
                    Open link
                    <Tooltip.Arrow className="fill-neutral-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </div>

        {description && (
          <p className={clsx("line-clamp-3 text-neutral-300 leading-relaxed", sizes.text)} title={description}>
            {description}
          </p>
        )}

        <div className="h-px w-full bg-gradient-to-r from-white/5 via-white/10 to-white/5" />

        <div className="flex items-center justify-between gap-2 text-neutral-400 flex-wrap">
          {priceAmount != null && (
            <span className="rounded px-2 py-0.5 text-xs font-semibold text-neutral-100 bg-neutral-800">
              {String(priceAmount)} {priceUnit || "TTRUST"}
            </span>
          )}
          {owner && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-neutral-500/80">Owner</span>
              <Tooltip.Provider delayDuration={150}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="truncate text-xs font-medium text-neutral-300 tabular-nums tracking-tight">
                      {shortenAddress(owner)}
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      sideOffset={6}
                      className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 shadow-xl"
                    >
                      {owner}
                      <Tooltip.Arrow className="fill-neutral-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
          )}
        </div>

        {(ctaPrimary || ctaSecondary || onClick) && (
          <div className="pt-1.5 flex items-center justify-center gap-2">
            {ctaPrimary && (
              <button
                className={clsx(
                  "rounded-md border border-transparent bg-[var(--color-primary)] text-[var(--color-primary-content)] hover:opacity-90",
                  "transition-all duration-150 transform active:scale-95 will-change-transform",
                  sizes.btn,
                )}
                onClick={ctaPrimary.onClick}
                disabled={ctaPrimary.disabled}
              >
                {ctaPrimary.label}
              </button>
            )}
            {ctaSecondary && (
              <button
                className={clsx(
                  "rounded-md border border-white/10 bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
                  "transition-all duration-150 transform active:scale-95 will-change-transform",
                  sizes.btn,
                )}
                onClick={ctaSecondary.onClick}
                disabled={ctaSecondary.disabled}
              >
                {ctaSecondary.label}
              </button>
            )}
            {onClick && !ctaPrimary && !ctaSecondary && (
              <button
                className={clsx(
                  "rounded-md border border-white/10 bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
                  "transition-transform transform active:scale-95 will-change-transform",
                  sizes.btn,
                )}
                onClick={onClick}
              >
                View
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );

  if (href && !href.startsWith("http")) {
    return (
      <Link href={href} className="block focus:outline-none">
        {CardInner}
      </Link>
    );
  }

  return CardInner;
}
