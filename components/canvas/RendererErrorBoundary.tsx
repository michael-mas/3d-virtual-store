"use client";

import { Component, type ReactNode } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Catches renderer creation failures (no WebGPU and no WebGL2, context creation refused) and anything else
 * thrown from the Canvas tree; the message is shown by StatusOverlays instead of a blank page.
 */
export default class RendererErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[renderer]", error);
    useAppStore
      .getState()
      .setRendererError(
        "Your browser or device couldn't start 3D rendering (WebGPU or WebGL 2 is required). Try an up-to-date Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled.",
      );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
