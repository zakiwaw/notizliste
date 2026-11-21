import { useEffect, useMemo, useState } from "react";
import { RotateCw, X } from "lucide-react";
import { gs1128Widths } from "@/lib/code128";

const QUIET = 10; // Ruhezone links/rechts in Modulen

export const BarcodeSheet = ({ code, onClose }) => {
  const [wide, setWide] = useState(false);
  const [, redraw] = useState(0);

  useEffect(() => {
    const onResize = () => redraw((n) => n + 1);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const { bars, total } = useMemo(() => {
    const out = [];
    let x = QUIET;
    [...gs1128Widths(code)].forEach((c, i) => {
      if (i % 2 === 0) out.push([x, +c]);
      x += +c;
    });
    return { bars: out, total: x + QUIET };
  }, [code]);

  // Modulbreite auf ganze Geräte-Pixel runden: scharfe Balken, sicherer zu scannen
  const dpr = window.devicePixelRatio || 1;
  const avail = (wide ? window.innerHeight : window.innerWidth) - 32;
  const mod = Math.max(1, Math.floor((avail * dpr) / total)) / dpr;

  return (
    <div className="bc" role="dialog" aria-label="SSCC als Barcode" data-testid="barcode-sheet">
      <div className={`bc-stage${wide ? " wide" : ""}`}>
        <div className="bc-top">
          <button type="button" className="bc-btn" onClick={() => setWide((w) => !w)} data-testid="barcode-rotate">
            <RotateCw size={18} /> {wide ? "Hochkant" : "Quer (größer)"}
          </button>
          <button type="button" className="bc-btn" onClick={onClose} aria-label="Schließen" data-testid="barcode-close">
            <X size={20} />
          </button>
        </div>
        <div className="bc-body">
          <svg
            className="bc-svg"
            viewBox={`0 0 ${total} 1`}
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
            style={{ width: total * mod, height: wide ? "40dvw" : "28dvh" }}
            role="img"
            aria-label={`Barcode ${code}`}
            data-testid="barcode-svg"
          >
            <rect width={total} height="1" fill="#fff" />
            {bars.map(([x, w]) => <rect key={x} x={x} width={w} height="1" fill="#000" />)}
          </svg>
          <div className="bc-code" data-testid="barcode-code">{code}</div>
          <div className="bc-hint">SSCC · GS1-128</div>
        </div>
      </div>
    </div>
  );
};
