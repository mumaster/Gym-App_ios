import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ImageIcon,
  SwitchCamera,
  X,
} from "lucide-react";
import { DumbbellLoader } from "./DumbbellLoader";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";
import { createVideoDecoder, SCAN_INTERVAL_MS } from "../../lib/gym/barcodeDecode";
import {
  backCameras,
  loadCameraId,
  saveCameraId,
  shortLensName,
  type BackCamera,
} from "../../lib/gym/cameraChoice";

/** The deviceId of the lens a playing video is currently showing. */
function stream_track_id(video: HTMLVideoElement | null): string | null {
  const stream = video?.srcObject;
  if (typeof MediaStream === "undefined" || !(stream instanceof MediaStream)) return null;
  return stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
}

/** Opens the connection to a host ahead of the first request. */
function preconnect(href: string) {
  if (document.head.querySelector(`link[rel=preconnect][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

export type FoodScannerStatus = "scanning" | "lookingUp" | "notFound";

/** What the camera is pointed at. "barcode" reads barcodes live, with no
 *  shutter; "label" sends the shutter's photo to the AI label reader; "note"
 *  and "plate" send it to the list reader (FoodListSheet). */
export type ScanMode = "barcode" | "label" | "note" | "plate" | "qr";

/** A sideways swipe this far over the picture switches mode, like the iOS
 *  camera. A gesture threshold, not a measured value. */
const SWIPE_PX = 50;

/** When to suggest the Label mode if no barcode has shown up — a UX nudge,
 *  not a measured value. Nothing is sent to the AI automatically. */
const LABEL_HINT_MS = 3000;

/**
 * One camera for every scan, in modes switched above the shutter (or by a
 * sideways swipe). Barcode mode, the first, has zxing-js decode barcodes
 * continuously against the live stream (free, offline, instant) and shows
 * no shutter. Label mode's shutter grabs the current frame for the AI label
 * reader (also where a barcode the product database doesn't know sends you).
 * Note and plate mode send the shutter's photo to the list reader. Barcodes
 * are only decoded in barcode mode, so a package in view can't take over.
 * Full-screen `fixed inset-0 z-[60]`, above AddFoodSheet's own z-50 sheet.
 * zxing is imported inside the effect, so it's only fetched when the scanner
 * opens (and not at all where BarcodeDetector exists). After a detection the
 * stream keeps running and barcodes are ignored while the parent looks one
 * up (`status !== "scanning"`) — the shutter must stay usable if the lookup
 * comes back empty.
 */
export function FoodScanner({
  open,
  status,
  onClose,
  onBarcode,
  onPhoto,
  onChoosePhoto,
  modes = ["barcode", "label"],
  mode = modes[0] ?? "barcode",
  onMode,
}: {
  open: boolean;
  status: FoodScannerStatus;
  onClose: () => void;
  /** A decoded barcode (label mode only); the parent sets `status` to
   *  "lookingUp". */
  onBarcode?: (barcode: string) => void;
  /** The shutter's captured frame, with the mode it was taken in. */
  onPhoto: (photo: Blob, mode: ScanMode) => void;
  /** Pick an existing photo instead of the live camera. */
  onChoosePhoto: (mode: ScanMode) => void;
  /** The modes to offer; with more than one, a switch above the shutter. */
  modes?: ScanMode[];
  mode?: ScanMode;
  onMode?: (mode: ScanMode) => void;
}) {
  const t = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  // The back lens in use (null: the browser's default back camera) and the
  // back lenses the device offers; a switch shows when there are several.
  const [cameraId, setCameraId] = useState<string | null>(loadCameraId);
  const [cameras, setCameras] = useState<BackCamera[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  /** Barcodes already reported while the camera is open: one the database
   *  didn't know is still in view after switching back to Barcode, and
   *  shouldn't send you straight back to Label. */
  const reported = useRef(new Set<string>());

  // Refs, not deps: the parent's callbacks and status change every render,
  // and the camera must only restart when the scanner opens or closes.
  const onBarcodeRef = useRef(onBarcode);
  onBarcodeRef.current = onBarcode;
  const statusRef = useRef(status);
  statusRef.current = status;

  // The "no barcode?" nudge, counted from opening or switching to Barcode.
  useEffect(() => {
    setShowHint(false);
    if (!open || mode !== "barcode") return;
    const hint = setTimeout(() => setShowHint(true), LABEL_HINT_MS);
    return () => clearTimeout(hint);
  }, [open, mode]);

  useEffect(() => {
    if (!open) setMenuOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    reported.current.clear();

    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Camera and decoder start together (they used to run one after the
    // other), and the product database connection is opened early.
    preconnect("https://world.openfoodfacts.org");
    const video = videoRef.current;
    // Ask for a high-resolution stream: the same frames feed the label
    // reader, which needs legible print.
    const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const getCamera = (video: MediaTrackConstraints) =>
      navigator.mediaDevices.getUserMedia({ video });
    const cameraReady = (
      cameraId
        ? // A remembered lens that's gone (or refused) falls back to the default.
          getCamera({ deviceId: { exact: cameraId }, ...size }).catch(() =>
            getCamera({ facingMode: "environment", ...size }),
          )
        : getCamera({ facingMode: "environment", ...size })
    ).then(async (s) => {
      stream = s;
      if (cancelled) {
        s.getTracks().forEach((track) => track.stop());
        return null;
      }
      // Labels (and so the lens list) only exist once permission is granted.
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (!cancelled) setCameras(backCameras(devices));
        })
        .catch(() => undefined);
      if (video) {
        video.srcObject = s;
        await video.play().catch(() => undefined);
      }
      return video;
    });
    const decoderReady = video ? createVideoDecoder(video) : Promise.resolve(null);

    Promise.all([cameraReady, decoderReady])
      .then(([v, decode]) => {
        if (cancelled || !v || !decode) return;
        const tick = async () => {
          if (cancelled) return;
          // Nothing to decode while a lookup runs or in photo modes.
          const scanning =
            statusRef.current === "scanning" &&
            (modeRef.current === "barcode" || modeRef.current === "qr") &&
            !!onBarcodeRef.current &&
            v.readyState >= 2;
          if (scanning) {
            const code = await decode().catch(() => null);
            if (code && !cancelled && !reported.current.has(code)) {
              reported.current.add(code);
              haptic([20, 30]);
              onBarcodeRef.current?.(code);
            }
          }
          if (!cancelled) timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };
        void tick();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? t.barcodeScanner.cameraAccessDenied
            : t.barcodeScanner.cameraStartFailed,
        );
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [open, t, cameraId]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    haptic([15, 25]);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onPhoto(blob, mode), "image/jpeg", 0.92);
  };

  const activeId = cameraId ?? stream_track_id(videoRef.current) ?? cameras[0]?.deviceId ?? null;
  const activeName = shortLensName(cameras.find((c) => c.deviceId === activeId)?.label ?? "");
  const pickCamera = (id: string) => {
    setMenuOpen(false);
    if (id === activeId) return;
    haptic(10);
    saveCameraId(id);
    setCameraId(id);
  };

  const switchMode = (next: ScanMode) => {
    if (next === mode || !onMode) return;
    haptic(10);
    onMode(next);
  };

  const onSwipeEnd = (x: number, y: number) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || modes.length < 2) return;
    const dx = x - start.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(y - start.y)) return;
    const i = modes.indexOf(mode) + (dx < 0 ? 1 : -1);
    const next = modes[i];
    if (next) switchMode(next);
  };

  if (!open) return null;

  const copy = t.barcodeScanner;
  const barcode = mode === "barcode" || mode === "qr";
  const busy = barcode && status === "lookingUp";
  // A barcode the database didn't know lands here, in Label mode.
  const highlight = mode === "label" && status === "notFound";
  const message = highlight
    ? copy.notFound
    : busy
      ? copy.lookingUp
      : barcode && showHint && modes.includes("label")
        ? copy.noBarcodeHint
        : copy.aimFor[mode];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />

      <div className="safe-top relative flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-5 pb-6 pt-3">
        <p className="text-[15px] font-semibold text-white">{copy.titleFor[mode]}</p>
        <div className="flex items-center gap-2">
          {cameras.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={`${copy.switchCamera}: ${activeName}`}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                className="glass flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-white active:scale-95"
              >
                <SwitchCamera className="size-4" />
                {activeName}
                <ChevronDown className="size-3.5" />
              </button>
              {menuOpen ? (
                <>
                  <button
                    aria-label={t.common.close}
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="listbox"
                    aria-label={copy.switchCamera}
                    className="glass-strong absolute right-0 top-full z-20 mt-2 min-w-48 overflow-hidden rounded-2xl py-1 text-white"
                  >
                    {cameras.map((c) => (
                      <button
                        key={c.deviceId}
                        role="option"
                        aria-selected={c.deviceId === activeId}
                        onClick={() => pickCamera(c.deviceId)}
                        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 text-left text-[14px] font-semibold active:bg-white/10"
                      >
                        {shortLensName(c.label)}
                        {c.deviceId === activeId ? <Check className="size-4" /> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <button
            onClick={onClose}
            aria-label={t.common.close}
            className="glass flex size-9 items-center justify-center rounded-full text-white active:scale-95"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-10"
        onTouchStart={(e) => {
          const p = e.touches[0];
          swipeStart.current = p ? { x: p.clientX, y: p.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const p = e.changedTouches[0];
          if (p) onSwipeEnd(p.clientX, p.clientY);
        }}
      >
        {error ? (
          <p className="glass-strong flex max-w-xs items-start gap-2 rounded-2xl px-4 py-3 text-[14px] text-white">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
            {error}
          </p>
        ) : busy ? (
          <DumbbellLoader size={56} className="text-white" />
        ) : (
          // The frame's shape says what fits in it: a label, a sheet of
          // paper, a round plate.
          <div
            aria-hidden
            className={`border-2 border-white/70 transition-[aspect-ratio,border-radius,width] duration-200 motion-reduce:transition-none ${
              mode === "barcode"
                ? "aspect-[2/1] w-full max-w-sm rounded-2xl"
                : mode === "qr"
                  ? "aspect-square w-[min(100%,16rem)] rounded-2xl"
                  : mode === "label"
                    ? "aspect-[4/5] w-[min(100%,16rem)] rounded-2xl"
                    : mode === "note"
                      ? "aspect-[3/4] w-[min(100%,15rem)] rounded-2xl"
                      : "aspect-square w-[min(100%,16rem)] rounded-full"
            }`}
          />
        )}
      </div>

      <div className="safe-bottom relative flex flex-col items-center gap-4 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-6 pb-6 pt-10">
        <p
          className={`max-w-xs text-center text-[14px] ${
            highlight ? "font-semibold text-white" : "text-white/80"
          }`}
        >
          {message}
        </p>
        {modes.length > 1 ? (
          <div
            role="radiogroup"
            aria-label={copy.modeLabel}
            className="flex rounded-full bg-white/15 p-1 backdrop-blur-md"
          >
            {modes.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={m === mode}
                onClick={() => switchMode(m)}
                className={`tap-target min-h-[36px] rounded-full px-3.5 text-[14px] font-semibold transition-colors motion-reduce:transition-none ${
                  m === mode ? "bg-white text-black" : "text-white/85"
                }`}
              >
                {copy.modes[m]}
              </button>
            ))}
          </div>
        ) : null}
        {barcode ? (
          // Nothing to press: a barcode is read the moment it's in view.
          // The row keeps the shutter's height so switching doesn't jump.
          <div className="h-[72px]" aria-hidden />
        ) : (
          <div className="flex w-full max-w-xs items-center justify-between">
            <button
              onClick={() => onChoosePhoto(mode)}
              aria-label={copy.choosePhoto}
              className="glass flex size-12 items-center justify-center rounded-full text-white active:scale-95"
            >
              <ImageIcon className="size-5" />
            </button>
            <button
              onClick={capture}
              disabled={!!error}
              aria-label={copy.shutterFor[mode]}
              className={`flex size-[72px] items-center justify-center rounded-full border-4 border-white bg-white text-black active:scale-95 disabled:opacity-40 ${
                highlight ? "ring-4 ring-primary" : ""
              }`}
            >
              <Camera className="size-7" />
            </button>
            <span className="size-12" aria-hidden />
          </div>
        )}
        <p className="text-[12px] text-white/70">{copy.captionFor[mode]}</p>
      </div>
    </div>
  );
}
