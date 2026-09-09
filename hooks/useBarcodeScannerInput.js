"use client";

import { useEffect, useRef } from "react";

// Keyboard-wedge barcode scanner support: USB/Bluetooth scanners emulate a
// keyboard — a burst of characters followed by Enter. The hook listens for
// that pattern OUTSIDE of text inputs (so typing in the search box is never
// hijacked) and reports the buffered code.
export function useBarcodeScannerInput({ enabled = true, onScan, minLength = 4, burstMs = 80 }) {
  const bufferRef = useRef("");
  const lastKeyRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    function isTypingTarget(target) {
      const tag = target?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
    }

    function handleKeyDown(event) {
      const now = Date.now();
      if (now - lastKeyRef.current > 500) {
        bufferRef.current = "";
      }
      lastKeyRef.current = now;

      if (event.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= minLength) {
          event.preventDefault();
          onScan?.(code);
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isTypingTarget(event.target)) {
          bufferRef.current = "";
          return;
        }
        bufferRef.current += event.key;
        if (bufferRef.current.length > 64) {
          bufferRef.current = bufferRef.current.slice(-64);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, onScan, minLength, burstMs]);
}
