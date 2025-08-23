import React from "react";
import { SwitchTheme } from "~~/components/SwitchTheme";

/**
 * Site footer
 */
export const Footer = () => {
  // Minimal footer; only theme switcher and credits retained

  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0">
      {/* Floating theme switcher only */}
      <div className="fixed flex justify-end items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
        <SwitchTheme className={`pointer-events-auto`} />
      </div>
      {/* Subtle credit - part of normal flow (not sticky) */}
      <div className="w-full flex justify-center items-center pointer-events-none z-10 mt-6">
        <p className="text-sm md:text-base font-semibold text-base-content/70 pointer-events-auto">
          Inspired by{" "}
          <a href="https://www.intuition.systems/" target="_blank" rel="noreferrer" className="link">
            Intuition
          </a>
        </p>
      </div>
    </div>
  );
};
