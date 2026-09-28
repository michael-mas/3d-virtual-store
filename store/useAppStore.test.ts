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
    s.setOption("finish", "glass");
    s.setOption("frameColor", "#ff0000");
    s.setOption("lens", "holographic");
    s.setCalibration(id, { scale: 1.1 });
    const next = useAppStore.getState();
    expect(next.configs[id]).toEqual({ finish: "glass", frameColor: "#ff0000", lens: "holographic" });
    expect(next.calibrations[id]).toEqual({ offset: [0, 0, 0], scale: 1.1 });
  });

  it("ignores options and values outside the product schema", () => {
    const s = useAppStore.getState();
    const before = s.configs[s.activeProductId];
    s.setOption("finish", "wood");
    s.setOption("frameColor", "not-a-color");
    s.setOption("nope", "x");
    expect(useAppStore.getState().configs[s.activeProductId]).toEqual(before);
  });

  it("adds the active config to the cart as a snapshot", () => {
    const s = useAppStore.getState();
    s.addToCart();
    s.setOption("lens", "iridescent");
    const { items, activeProductId } = useAppStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(activeProductId);
    expect(items[0].config.lens).toBe("clear");
  });
});

describe("photo lifecycle", () => {
  beforeEach(() => useAppStore.setState(initial, true));

  it("revokes the photo URL when replaced and when leaving PHOTO", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const s = useAppStore.getState();
    s.transition("INTERACT");
    s.transition("TRY_ON");
    s.transition("CAPTURE");
    s.setPhotoUrl("blob:a");
    s.setPhotoUrl("blob:b");
    expect(revoke).toHaveBeenCalledWith("blob:a");
    s.transition("RETAKE");
    expect(revoke).toHaveBeenCalledWith("blob:b");
    expect(useAppStore.getState().photoUrl).toBeNull();
  });
});

describe("cart", () => {
  beforeEach(() => useAppStore.setState(initial, true));
  afterEach(() => vi.restoreAllMocks());

  it("stores the thumbnail URL and bumps the fx counter", () => {
    const s = useAppStore.getState();
    const id = s.addToCart("blob:thumb");
    const { items, cartFxId } = useAppStore.getState();
    expect(items.find((i) => i.id === id)?.thumbnailUrl).toBe("blob:thumb");
    expect(cartFxId).toBe(initial.cartFxId + 1);
  });

  it("revokes thumbnails on remove and clear", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const s = useAppStore.getState();
    const a = s.addToCart("blob:a");
    s.addToCart("blob:b");
    s.removeFromCart(a);
    expect(revoke).toHaveBeenCalledWith("blob:a");
    s.clearCart();
    expect(revoke).toHaveBeenCalledWith("blob:b");
    expect(useAppStore.getState().items).toHaveLength(0);
  });

  it.each([
    ["EXPLORE", []],
    ["CUSTOMIZE", ["INTERACT"]],
    ["TRY_ON", ["INTERACT", "TRY_ON"]],
    ["PHOTO", ["INTERACT", "TRY_ON", "CAPTURE"]],
  ] as const)("Try On from %s restores the config and ends in TRY_ON", (_, path) => {
    const s = useAppStore.getState();
    s.setOption("lens", "holographic");
    s.setOption("finish", "glass");
    const id = s.addToCart();
    s.setOption("lens", "clear");
    s.setOption("finish", "matte");
    for (const e of path) s.transition(e);
    s.setCartOpen(true);
    s.tryOnCartItem(id);
    const next = useAppStore.getState();
    expect(next.mode).toBe("TRY_ON");
    expect(next.cartOpen).toBe(false);
    expect(next.configs[next.activeProductId]).toMatchObject({ finish: "glass", lens: "holographic" });
  });
});

describe("late thumbnails", () => {
  beforeEach(() => useAppStore.setState(initial, true));
  afterEach(() => vi.restoreAllMocks());

  it("attaches to an existing item and is revoked if the item was removed", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const s = useAppStore.getState();
    const a = s.addToCart();
    s.setItemThumbnail(a, "blob:a");
    expect(useAppStore.getState().items[0].thumbnailUrl).toBe("blob:a");
    const b = s.addToCart();
    s.removeFromCart(b);
    s.setItemThumbnail(b, "blob:late");
    expect(revoke).toHaveBeenCalledWith("blob:late");
  });
});

describe("interactWith", () => {
  beforeEach(() => useAppStore.setState(initial, true));
  afterEach(() => vi.restoreAllMocks());

  it("selects the product and enters CUSTOMIZE from EXPLORE", () => {
    expect(useAppStore.getState().interactWith("crystal")).toBe(true);
    expect(useAppStore.getState().activeProductId).toBe("crystal");
    expect(useAppStore.getState().mode).toBe("CUSTOMIZE");
  });

  it("does not change the product outside EXPLORE", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = useAppStore.getState();
    s.transition("INTERACT");
    expect(s.interactWith("studio")).toBe(false);
    expect(useAppStore.getState().activeProductId).toBe(initial.activeProductId);
  });
});
