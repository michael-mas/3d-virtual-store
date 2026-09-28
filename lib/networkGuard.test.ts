import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("installNetworkGuard", () => {
  const calls: string[] = [];
  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    vi.stubGlobal("window", {
      location: { href: "https://store.example/", origin: "https://store.example" },
      fetch: async (input: RequestInfo | URL) => {
        calls.push(String(input instanceof Request ? input.url : input));
        return new Response("ok", { status: 200 });
      },
    });
    vi.stubGlobal("navigator", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("answers cross-origin requests locally and lets same-origin ones through", async () => {
    const { installNetworkGuard } = await import("./networkGuard");
    installNetworkGuard();
    const blocked = await window.fetch("https://odml.pa.googleapis.com/v1/log", { method: "POST" });
    expect(blocked.status).toBe(204);
    const local = await window.fetch("/mediapipe/manifest.json");
    expect(local.status).toBe(200);
    const blob = await window.fetch("blob:https://store.example/abc");
    expect(blob.status).toBe(200);
    expect(calls).toEqual(["/mediapipe/manifest.json", "blob:https://store.example/abc"]);
  });
});
