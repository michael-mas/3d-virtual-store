"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";
import { useAppStore } from "@/store/useAppStore";

/** Mannequin preview chunk; also prefetched while idle (see IdlePrefetch). */
export const loadMannequinPreview = () => import("./MannequinPreview");
const MannequinPreview = lazy(loadMannequinPreview);

/**
 * What a surface product shows on its pedestal: its packaging in EXPLORE (and while the preview loads), the
 * mannequin head wearing the current configuration in CUSTOMIZE. The mannequin stays mounted once created
 * (hidden when not customizing), so its materials compile only once.
 */
export default function SurfaceProductDisplay({ productId, packaging }: { productId: string; packaging: ReactNode }) {
  const previewing = useAppStore((s) => s.mode === "CUSTOMIZE" && s.activeProductId === productId);
  const [mounted, setMounted] = useState(false);
  if (previewing && !mounted) setMounted(true);
  return (
    <>
      {!previewing && packaging}
      {mounted && (
        <Suspense fallback={previewing ? packaging : null}>
          <MannequinPreview productId={productId} visible={previewing} />
        </Suspense>
      )}
    </>
  );
}
