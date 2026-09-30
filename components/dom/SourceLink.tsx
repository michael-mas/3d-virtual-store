"use client";

import { AUTHOR, REPO_URL } from "@/lib/site";
import { useAppStore } from "@/store/useAppStore";

const PILL = "rounded-full bg-neutral-900/85 text-white shadow-lg ring-1 ring-white/10 hover:bg-neutral-800";

function GitHubIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * Author and source-code link, top left while exploring (hidden in the product, try-on and photo views).
 * Phones get an icon button (the page title is centered on a narrow screen); wider screens the full credit.
 */
export default function SourceLink() {
  const exploring = useAppStore((s) => s.mode === "EXPLORE");
  if (!exploring) return null;
  return (
    <div className="pointer-events-auto fixed top-3 left-3 z-30">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Source code on GitHub, by ${AUTHOR.name}`}
        className={`${PILL} block p-3 sm:hidden`}
      >
        <GitHubIcon className="size-6" />
      </a>
      <p className={`${PILL} hidden items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900/85 sm:flex`}>
        <GitHubIcon className="size-4 text-white" />
        <span>
          By{" "}
          <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">
            {AUTHOR.name}
          </a>{" "}
          ·{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">
            Source code
          </a>
        </span>
      </p>
    </div>
  );
}
