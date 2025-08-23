"use client";

import { FC } from "react";

// simple local cn util to avoid pulling additional helpers
function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const NFTCardSkeleton: FC<{ className?: string; withFooter?: boolean }> = ({ className, withFooter }) => {
  return (
    <div
      className={clsx(
        "rounded-xl border border-white/5 bg-neutral-900/60 backdrop-blur-sm shadow-[0_10px_20px_-10px_rgba(0,0,0,0.35)]",
        "overflow-hidden select-none",
        className,
      )}
    >
      <div className="relative w-full aspect-square bg-neutral-800 animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-5 w-2/3 rounded-md bg-neutral-800 animate-pulse" />
        <div className="h-4 w-1/2 rounded-md bg-neutral-800 animate-pulse" />
        {withFooter && (
          <div className="pt-3 flex items-center gap-2">
            <div className="h-9 w-24 rounded-md bg-neutral-800 animate-pulse" />
            <div className="h-9 w-24 rounded-md bg-neutral-800 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};
