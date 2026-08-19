import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import { CameraOff, Flashlight, LoaderCircle, QrCode, RefreshCw, Settings, X } from 'lucide-react';
import { businessQrService, businessQrToken, type QrBusiness } from '../services/businessQrService';

type DetectorResult = { rawValue: string };
type DetectorInstance = { detect: (source: HTMLVideoElement) => Promise<DetectorResult[]> };
type DetectorConstructor = new (options: { formats: string[] }) => DetectorInstance;
type ScannerState = 'starting' | 'scanning' | 'denied' | 'unsupported' | 'invalid';

// Manual QR-link entry is a development aid only and never ships in the
// customer UI. Production builds render the camera experience alone.
const SHOW_DEV_FALLBACK = import.meta.env.DEV;

/** Minimum time the dark transition shell stays up, so it reads as intentional. */
const PREPARE_MIN_MS = 220;
/** Fade used when handing the screen back to Home. */
const CLOSE_FADE_MS = 200;

/**
 * covering  - opaque shell is up, Home already hidden, camera starting
 * live      - native preview is running and revealed inside the shell
 * closing   - shell is opaque again and fading out to Home
 */
type Phase = 'covering' | 'live' | 'closing';

export function QrScannerModal({
  open,
  onClose,
  onResolved,
}: {
  open: boolean;
  onClose: () => void;
  onResolved: (token: string, business: QrBusiness) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const nativeRef = useRef(false);
  const [state, setState] = useState<ScannerState>('starting');
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState('');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [phase, setPhase] = useState<Phase>('covering');
  const openedAt = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNative = Capacitor.isNativePlatform();

  /**
   * Reveals the camera only after the shell has been up for a beat, so the
   * transition never snaps and the native preview is genuinely ready.
   */
  const revealWhenReady = useCallback(() => {
    if (revealTimer.current !== null) clearTimeout(revealTimer.current);
    const elapsed = Date.now() - openedAt.current;
    const wait = Math.max(0, PREPARE_MIN_MS - elapsed);
    revealTimer.current = setTimeout(() => setPhase('live'), wait);
  }, []);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (nativeRef.current) {
      nativeRef.current = false;
      document.body.classList.remove('barcode-scanner-active');
      void BarcodeScanner.stopScan().catch(() => undefined);
      void BarcodeScanner.removeAllListeners().catch(() => undefined);
    }
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const resolve = useCallback(
    async (raw: string) => {
      const token = businessQrToken(raw);
      if (!token) {
        setState('invalid');
        setMessage("This QR isn't linked to a business on our platform.");
        return;
      }
      try {
        const { business } = await businessQrService.resolve(token);
        stop();
        onResolved(token, business);
      } catch (error) {
        setState('invalid');
        setMessage(error instanceof Error ? error.message : "This QR isn't linked to a business on our platform.");
      }
    },
    [onResolved, stop],
  );

  const startNative = useCallback(async () => {
    let permission = await BarcodeScanner.checkPermissions();
    if (permission.camera === 'prompt' || permission.camera === 'prompt-with-rationale') {
      permission = await BarcodeScanner.requestPermissions();
    }
    if (permission.camera !== 'granted') {
      setState('denied');
      setMessage('Camera access is off. Enable Camera Access in Settings, then try again.');
      revealWhenReady();
      return;
    }
    nativeRef.current = true;
    await BarcodeScanner.addListener('barcodesScanned', (event) => {
      const raw = event.barcodes[0]?.rawValue;
      if (raw) void resolve(raw);
    });
    await BarcodeScanner.addListener('scanError', (event) => {
      setState('invalid');
      setMessage(event.message || 'Camera could not scan this code. Please try again.');
    });
    setState('scanning');
    await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode], lensFacing: LensFacing.Back });
    // Go transparent only once the native preview is actually running. The
    // opaque shell stays up until revealWhenReady() promotes the phase, so the
    // WebView is never see-through while Home is still painted underneath.
    document.body.classList.add('barcode-scanner-active');
    revealWhenReady();
    try {
      const { available } = await BarcodeScanner.isTorchAvailable();
      setTorchAvailable(available);
    } catch {
      setTorchAvailable(false);
    }
  }, [resolve, revealWhenReady]);

  const startWeb = useCallback(async () => {
    const Detector = (globalThis as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setState('unsupported');
      revealWhenReady();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    streamRef.current = stream;
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setState('scanning');
    revealWhenReady();
    const detector = new Detector({ formats: ['qr_code'] });
    let busy = false;
    const scan = async () => {
      if (!videoRef.current || !streamRef.current) return;
      if (!busy) {
        busy = true;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            await resolve(codes[0].rawValue);
            return;
          }
        } catch {
          // Ignore per-frame decode errors and keep scanning.
        } finally {
          busy = false;
        }
      }
      frameRef.current = requestAnimationFrame(scan);
    };
    frameRef.current = requestAnimationFrame(scan);
  }, [resolve, revealWhenReady]);

  const start = useCallback(async () => {
    stop();
    setMessage('');
    setState('starting');
    try {
      if (isNative) await startNative();
      else await startWeb();
    } catch (error) {
      stop();
      setState('denied');
      setMessage(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Camera access is off. Enable Camera Access in Settings, then try again.'
          : 'Camera could not be started. Please try again.',
      );
      revealWhenReady();
    }
  }, [isNative, startNative, startWeb, stop, revealWhenReady]);

  // `start`/`stop` are recreated whenever a parent re-renders (onResolved is a
  // fresh closure each time). Depending on them here restarted the camera on
  // every parent render, which showed up as a ~1s flicker once a ticking clock
  // was added upstream. Hold them in refs so the camera lifecycle is tied to
  // `open` alone and the preview stays continuously mounted.
  const startRef = useRef(start);
  const stopRef = useRef(stop);
  useEffect(() => {
    startRef.current = start;
    stopRef.current = stop;
  }, [start, stop]);

  // Phase 1: hide Home the instant the scanner opens, before any camera or
  // WebView transparency work begins, so Home can never be composited through.
  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    setPhase('covering');
    setTorchOn(false);
    setTorchAvailable(false);
    document.body.classList.add('scanner-open');
    void startRef.current();
    return () => {
      if (revealTimer.current !== null) clearTimeout(revealTimer.current);
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      document.body.classList.remove('scanner-open');
      stopRef.current();
    };
  }, [open]);

  const toggleTorch = async () => {
    try {
      await BarcodeScanner.toggleTorch();
      setTorchOn((current) => !current);
    } catch {
      setTorchAvailable(false);
    }
  };

  const close = () => {
    if (phase === 'closing') return;
    // Repaint the shell opaque and tear the camera down behind it, then hand
    // the screen back to Home under a fade instead of snapping to it.
    setPhase('closing');
    stop();
    document.body.classList.remove('scanner-open');
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, CLOSE_FADE_MS);
  };

  if (!open) return null;

  const scanning = state === 'scanning';
  const shellOpaque = phase !== 'live';

  return createPortal(
    <div
      id="qr-scanner-modal"
      data-phase={phase}
      className={`fixed inset-0 z-[80] flex flex-col text-white transition-opacity duration-200 ease-out ${
        phase === 'closing' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Opaque cover. Present at full opacity from the first frame so Home is
          never visible through the scanner, and only dropped once live. */}
      <div
        id="qr-scanner-cover"
        aria-hidden
        className={`absolute inset-0 bg-[#070C0C] transition-opacity duration-200 ease-out ${
          shellOpaque ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Live camera sits behind this layer: native preview on device, video element on web. */}
      {!isNative && (
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div id="qr-scanner-scrim" className="pointer-events-none absolute inset-0 bg-black/45" />

      {/* Phase 2: dedicated transition screen while the camera spins up. */}
      {phase === 'covering' && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#070C0C]">
          <div className="animate-[qr-shell-in_220ms_ease-out] text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 ring-1 ring-white/15">
              <QrCode className="h-8 w-8 animate-pulse text-[#2DD4BF]" />
            </span>
            <p className="mt-4 text-sm font-semibold text-white/80">Opening scanner…</p>
          </div>
        </div>
      )}

      <header className="relative z-10 flex items-start justify-between gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={close}
          aria-label="Close scanner"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 backdrop-blur-sm transition active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 pt-1 text-center">
          <h2 className="text-base font-bold tracking-[-0.01em]">Scan QR</h2>
          <p className="mt-1 text-xs leading-5 text-white/70">Point your camera at the business QR</p>
        </div>
        {torchAvailable ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            aria-pressed={torchOn}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full backdrop-blur-sm transition active:scale-95 ${
              torchOn ? 'bg-white text-[#0F766E]' : 'bg-white/12 text-white'
            }`}
          >
            <Flashlight className="h-5 w-5" />
          </button>
        ) : (
          <span aria-hidden className="h-11 w-11 shrink-0" />
        )}
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-8">
        <div className="relative aspect-square w-full max-w-[19rem]">
          {/* Rounded corner brackets frame the scan target. */}
          <span className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-white/25" />
          <span className="pointer-events-none absolute -left-px -top-px h-12 w-12 rounded-tl-[2rem] border-l-[3px] border-t-[3px] border-[#2DD4BF]" />
          <span className="pointer-events-none absolute -right-px -top-px h-12 w-12 rounded-tr-[2rem] border-r-[3px] border-t-[3px] border-[#2DD4BF]" />
          <span className="pointer-events-none absolute -bottom-px -left-px h-12 w-12 rounded-bl-[2rem] border-b-[3px] border-l-[3px] border-[#2DD4BF]" />
          <span className="pointer-events-none absolute -bottom-px -right-px h-12 w-12 rounded-br-[2rem] border-b-[3px] border-r-[3px] border-[#2DD4BF]" />

          {scanning && (
            <span className="pointer-events-none absolute inset-x-5 top-0 h-px animate-[qr-scan-sweep_2.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#2DD4BF] to-transparent shadow-[0_0_12px_2px_rgba(45,212,191,0.55)]" />
          )}

          {!scanning && (
            <div className="absolute inset-0 grid place-items-center rounded-[2rem] bg-[#070C0C]/85 px-6 text-center">
              <div>
                {state === 'starting' ? (
                  <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[#2DD4BF]" />
                ) : (
                  <CameraOff className="mx-auto h-8 w-8 text-white/80" />
                )}
                <p className="mt-4 text-sm font-semibold leading-6">
                  {state === 'starting'
                    ? 'Starting camera…'
                    : message ||
                      (state === 'unsupported'
                        ? 'Camera scanning is not supported on this device.'
                        : "This QR isn't linked to a business on our platform.")}
                </p>
                {state !== 'starting' && (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {state === 'denied' && isNative && (
                      <button
                        type="button"
                        onClick={() => void BarcodeScanner.openSettings()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-bold transition active:scale-95"
                      >
                        <Settings className="h-4 w-4" /> Settings
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void startRef.current()}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#0B1211] transition active:scale-95"
                    >
                      <RefreshCw className="h-4 w-4" /> Try again
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 px-8 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2 text-center">
        <p className="text-xs leading-5 text-white/60">Only No-Wait Salon business QR codes are accepted.</p>

        {SHOW_DEV_FALLBACK && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void resolve(manual);
            }}
            className="mx-auto mt-4 flex max-w-sm gap-2"
          >
            <input
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="Dev only: paste QR link"
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
            />
            <button className="rounded-xl bg-white/15 px-4 text-sm font-bold">Open</button>
          </form>
        )}
      </footer>
    </div>,
    document.body,
  );
}
