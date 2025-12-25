'use client';

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

type QRReaderProps = {
  onDecode: (value: string) => void;
  onError?: (message: string) => void;
};

export function QRReader({ onDecode, onError }: QRReaderProps) {
  const [elementId] = useState(
    () => `qr-reader-${Math.random().toString(36).slice(2)}`
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      try {
        const html5QrCode = new Html5Qrcode(elementId, {
          verbose: false,
        });
        scannerRef.current = html5QrCode;
        setHasCamera(true);

        await html5QrCode.start(
          { facingMode: { exact: "environment" } },
          {
            fps: 10,
            qrbox: 260,
            aspectRatio: 1,
            disableFlip: false,
          },
          (decodedText) => {
            if (cancelled) {
              return;
            }
            onDecode(decodedText);
            html5QrCode.stop().catch(() => undefined);
            html5QrCode.clear();
          },
          (errorMessage) => {
            if (cancelled) {
              return;
            }
            onError?.(errorMessage);
          }
        );
      } catch (error) {
        console.error(error);
        setHasCamera(false);
        onError?.(
          error instanceof Error
            ? error.message
            : "Unable to access camera for scanning."
        );
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => {
            scanner.clear();
          })
          .catch(() => {
            scanner.clear();
          });
      }
    };
  }, [elementId, onDecode, onError]);

  if (!hasCamera) {
    return (
      <div className="flex h-64 items-center justify-center bg-slate-900 text-sm text-slate-300">
        Camera unavailable. Enter the code manually.
      </div>
    );
  }

  return (
    <div className="relative h-64 w-full overflow-hidden bg-black">
      <div id={elementId} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-48 w-48 rounded-2xl border-2 border-indigo-400/80">
          <div className="absolute inset-0">
            <div className="absolute left-6 right-6 top-6 h-[2px] animate-pulse bg-indigo-400/80" />
            <div className="absolute left-6 right-6 bottom-6 h-[2px] bg-indigo-400/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
