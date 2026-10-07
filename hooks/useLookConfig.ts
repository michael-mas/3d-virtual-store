import { useMemo } from "react";
import { getProduct, lookConfig, type ProductConfig } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";

/** A piece's configuration as it is rendered and worn: its collection's settings over the visitor's choices. */
export function useLookConfig(productId: string): ProductConfig {
  const config = useAppStore((s) => s.configs[productId]);
  return useMemo(() => lookConfig(getProduct(productId), config), [productId, config]);
}
