import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "./useAppStore";

const initial = useAppStore.getState();

describe("useAppStore", () => {
  beforeEach(() => useAppStore.setState(initial, true));
  afterEach(() => vi.restoreAllMocks());

  it("starts in EXPLORE with the cart closed", () => {
    expect(useAppStore.getState().mode).toBe("EXPLORE");
    expect(useAppStore.getState().cartOpen).toBe(false);
  });

  it("walks the full happy path", () => {
    const { transition } = useAppStore.getState();
    const path = [
      ["INTERACT", "CUSTOMIZE"],
      ["TRY_ON", "TRY_ON"],
      ["CAPTURE", "PHOTO"],
      ["RETAKE", "TRY_ON"],
      ["CAPTURE", "PHOTO"],
      ["EXIT", "CUSTOMIZE"],
      ["BACK", "EXPLORE"],
    ] as const;
    for (const [event, mode] of path) {
      expect(transition(event)).toBe(true);
      expect(useAppStore.getState().mode).toBe(mode);
    }
  });

  it("ignores and logs invalid transitions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(useAppStore.getState().transition("CAPTURE")).toBe(false);
    expect(useAppStore.getState().mode).toBe("EXPLORE");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("CAPTURE");
  });

  it("keeps cartOpen independent of mode", () => {
    const s = useAppStore.getState();
    s.setCartOpen(true);
    s.transition("INTERACT");
    s.transition("TRY_ON");
    expect(useAppStore.getState().cartOpen).toBe(true);
    s.toggleCart();
    expect(useAppStore.getState().mode).toBe("TRY_ON");
    expect(useAppStore.getState().cartOpen).toBe(false);
  });

  it("updates the active product config and per-product calibration", () => {
    const s = useAppStore.getState();
    const id = s.activeProductId;
    s.setFinish("glass");
    s.setFrameColor("#ff0000");
    s.setLensEffect("holographic");
    s.setCalibration(id, { scale: 1.1 });
    const next = useAppStore.getState();
    expect(next.configs[id]).toEqual({ finish: "glass", frameColor: "#ff0000", lens: "holographic" });
    expect(next.calibrations[id]).toEqual({ offset: [0, 0, 0], scale: 1.1 });
  });

  it("adds the active config to the cart as a snapshot", () => {
    const s = useAppStore.getState();
    s.addToCart();
    s.setLensEffect("iridescent");
    const { items, activeProductId } = useAppStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(activeProductId);
    expect(items[0].config.lens).toBe("clear");
  });
});
