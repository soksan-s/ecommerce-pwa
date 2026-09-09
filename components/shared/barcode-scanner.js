"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, Flashlight, FlashlightOff, Loader2, RefreshCw, ScanLine, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Supported formats for native BarcodeDetector API when available
const DETECTABLE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "itf",
  "codabar",
  "qr_code",
];

function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1760, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch {
    // Audio / vibration errors are non-critical
  }
}

export function useCameraBarcodeScanner({ onDetected }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | starting | scanning | error
  const [errorMessage, setErrorMessage] = useState("");
  const [facingMode, setFacingMode] = useState("environment"); // environment | user
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const onDetectedRef = useRef(onDetected);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {}
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    setStatus("idle");
    setErrorMessage("");
  }, [stop]);

  const openScanner = useCallback(() => {
    setOpen(true);
    setStatus("starting");
    setErrorMessage("");
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const toggleCameraFacing = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    async function initCameraAndScanner() {
      setStatus("starting");
      setErrorMessage("");

      try {
        // Step 1: Get media stream with fallback
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback if specific facingMode constraint fails (e.g. desktop webcam)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check torch support
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack?.getCapabilities) {
          const capabilities = videoTrack.getCapabilities();
          if (capabilities.torch) {
            setTorchSupported(true);
          }
        }

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // Autoplay catch
          }
        }

        // Step 2: Initialize detection (native BarcodeDetector preferred, ZXing fallback)
        const hasNativeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

        if (hasNativeDetector) {
          try {
            let formats = DETECTABLE_FORMATS;
            if (typeof window.BarcodeDetector.getSupportedFormats === "function") {
              const supported = await window.BarcodeDetector.getSupportedFormats();
              formats = DETECTABLE_FORMATS.filter((f) => supported.includes(f));
            }
            const detector = new window.BarcodeDetector({ formats: formats.length ? formats : undefined });

            setStatus("scanning");

            timerRef.current = window.setInterval(async () => {
              if (!videoRef.current || videoRef.current.readyState < 2) return;
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length && barcodes[0].rawValue) {
                  const code = String(barcodes[0].rawValue).trim();
                  if (code) {
                    playScanBeep();
                    stop();
                    setStatus("idle");
                    setOpen(false);
                    onDetectedRef.current?.(code);
                  }
                }
              } catch {
                // Ignore transient frame decode errors
              }
            }, 180);

            return;
          } catch {
            // If native detector threw, fall through to ZXing
          }
        }

        // Fallback: ZXing reader
        const reader = new BrowserMultiFormatReader();
        setStatus("scanning");

        if (videoRef.current) {
          const controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (result) {
              const code = result.getText?.() || result.text;
              if (code) {
                playScanBeep();
                stop();
                setStatus("idle");
                setOpen(false);
                onDetectedRef.current?.(String(code).trim());
              }
            }
          });
          zxingControlsRef.current = controls;
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err?.message || "Could not access camera. Please check browser permissions.");
        }
      }
    }

    const videoEl = videoRef.current;

    initCameraAndScanner();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (zxingControlsRef.current) {
        try {
          zxingControlsRef.current.stop();
        } catch {}
        zxingControlsRef.current = null;
      }
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((track) => track.stop());
        } catch {}
        streamRef.current = null;
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [open, facingMode, stop]);

  return {
    open,
    status,
    errorMessage,
    openScanner,
    close,
    retry: openScanner,
    videoRef,
    torchSupported,
    torchOn,
    toggleTorch,
    toggleCameraFacing,
  };
}

export function BarcodeScannerModal({
  open,
  status,
  errorMessage,
  videoRef,
  onClose,
  onRetry,
  torchSupported,
  torchOn,
  onToggleTorch,
  onToggleCameraFacing,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3 bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--action)]/10 text-[var(--action)]">
              <ScanLine className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">Scan Barcode / QR</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Align barcode within frame</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {torchSupported && onToggleTorch && (
              <button
                type="button"
                onClick={onToggleTorch}
                className={`rounded-lg p-1.5 transition ${
                  torchOn
                    ? "bg-amber-500/20 text-amber-500"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
                }`}
                title={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                aria-label="Toggle flashlight"
              >
                {torchOn ? <Flashlight className="size-4 fill-current" /> : <FlashlightOff className="size-4" />}
              </button>
            )}

            {onToggleCameraFacing && (
              <button
                type="button"
                onClick={onToggleCameraFacing}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
                title="Switch camera"
                aria-label="Switch camera"
              >
                <Camera className="size-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
              aria-label="Close scanner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewport Container - Always holds video element so ref is never lost */}
        <div className="relative aspect-square w-full overflow-hidden bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            className={`size-full object-cover transition-opacity duration-300 ${
              status === "scanning" ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            autoPlay
            playsInline
            muted
          />

          {/* Scanning Reticle & Aiming Box */}
          {status === "scanning" && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
              {/* Target Scan Box */}
              <div className="relative h-44 w-60 rounded-2xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Corner markers */}
                <div className="absolute -top-0.5 -left-0.5 size-5 rounded-tl-xl border-t-3 border-l-3 border-[var(--action)]" />
                <div className="absolute -top-0.5 -right-0.5 size-5 rounded-tr-xl border-t-3 border-r-3 border-[var(--action)]" />
                <div className="absolute -bottom-0.5 -left-0.5 size-5 rounded-bl-xl border-b-3 border-l-3 border-[var(--action)]" />
                <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-br-xl border-b-3 border-r-3 border-[var(--action)]" />

                {/* Animated Laser Scan Line */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[var(--action)] to-transparent shadow-[0_0_8px_var(--action)] animate-pulse top-1/2 -translate-y-1/2" />
              </div>

              <p className="mt-4 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-xs">
                Hold still • Center code in box
              </p>
            </div>
          )}

          {/* Starting State Overlay */}
          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 text-center">
              <Loader2 className="size-8 animate-spin text-[var(--action)]" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">Starting camera…</p>
                <p className="text-[11px] text-white/60">Please allow camera access when prompted</p>
              </div>
            </div>
          )}

          {/* Error State Overlay */}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--surface-strong)] p-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                <Camera className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-[var(--foreground)]">Camera Access Unavailable</p>
                <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                  {errorMessage || "Check browser camera permissions or connect a USB barcode scanner."}
                </p>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[var(--action)] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:opacity-90"
                >
                  <RefreshCw className="size-3.5" />
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-[var(--border-soft)] bg-[var(--surface-quiet)] px-4 py-2.5 text-center">
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Supports UPC, EAN, Code 128, QR & USB / Bluetooth hardware scanners
          </p>
        </div>
      </div>
    </div>
  );
}
