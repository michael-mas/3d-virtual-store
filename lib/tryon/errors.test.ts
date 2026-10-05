import { describe, expect, it } from "vitest";
import { canUseDemo, classifyCameraError, tryOnError } from "./errors";

const dom = (name: string) => new DOMException("x", name);

describe("classifyCameraError", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "insecure"],
    ["NotFoundError", "no-camera"],
    ["OverconstrainedError", "no-camera"],
    ["NotReadableError", "in-use"],
    ["AbortError", "in-use"],
    ["SomethingElse", "unknown"],
  ])("%s → %s", (name, kind) => {
    expect(classifyCameraError(dom(name))).toBe(kind);
  });

  it("handles non-DOMException values", () => {
    expect(classifyCameraError("nope")).toBe("unknown");
  });
});

describe("tryOnError", () => {
  it("has a title and message for every kind", () => {
    const e = tryOnError("denied");
    expect(e.title).toBeTruthy();
    expect(e.message).toBeTruthy();
  });

  it("offers the demo video for camera problems only, when one is configured", () => {
    expect(canUseDemo("denied", true)).toBe(true);
    expect(canUseDemo("no-camera", true)).toBe(true);
    expect(canUseDemo("model", true)).toBe(false);
    expect(canUseDemo("demo", true)).toBe(false);
    expect(canUseDemo("photo", true)).toBe(false);
    expect(canUseDemo("denied", false)).toBe(false);
  });

  it("only mentions the demo video when it can be used", () => {
    expect(tryOnError("denied").message.includes("demo video")).toBe(canUseDemo("denied"));
  });
});
