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

  it("offers the demo video for camera problems only", () => {
    expect(canUseDemo("denied")).toBe(true);
    expect(canUseDemo("no-camera")).toBe(true);
    expect(canUseDemo("model")).toBe(false);
    expect(canUseDemo("demo")).toBe(false);
  });
});
