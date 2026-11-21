import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, X } from "lucide-react";
import { gs1128Widths } from "@/lib/code128";

const QUIET = 10; // Ruhezone links/rechts in Modulen
const CLOSE_DIST = 110; // so weit nach unten ziehen -> schließt
const CLOSE_SPEED = 0.6; // oder schneller als so viele px/ms (Wisch) -> schließt
const START_ZONE = 0.5; // Wischen zählt nur, wenn der Finger in der oberen Hälfte des Bildschirms startet
const ANIM_MS = 220;

export const BarcodeSheet = ({ code, onClose }) => {
  const [wide, setWide] = useState(false);
  const [dy, setDy] = useState(0);
  const [settling, setSettling] = useState(false); // true = Übergang animieren (Loslassen / Schließen)
  const [, redraw] = useState(0);
  const drag = useRef({ on: false, y0: 0, y: 0, t: 0, v: 0, dy: 0 });
  const closing = useRef(false);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setSettling(true);
    setDy(window.innerHeight);
    setTimeout(onClose, ANIM_MS);
  }, [onClose]);

  useEffect(() => {
    const onResize = () => redraw((n) => n + 1);
    const onKey = (e) => e.key === "Escape" && dismiss();
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [dismiss]);

  const onTouchStart = (e) => {
    if (closing.current) return;
    const y = e.touches[0].clientY;
    if (y > window.innerHeight * START_ZONE) return; // nur Wischen aus der oberen Hälfte schließt
    drag.current = { on: true, y0: y, y, t: e.timeStamp, v: 0, dy: 0 };
    setSettling(false);
  };
  const onTouchMove = (e) => {
    const d = drag.current;
    if (!d.on) return;
    const y = e.touches[0].clientY, dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (y - d.y) / dt;
    d.y = y; d.t = e.timeStamp;
    d.dy = Math.max(0, y - d.y0);
    setDy(d.dy);
  };
  const onTouchEnd = () => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    if (d.dy > CLOSE_DIST || (d.dy > 30 && d.v > CLOSE_SPEED)) return dismiss();
    setSettling(true);
    setDy(0);
  };

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
  const ease = settling ? `transform ${ANIM_MS}ms ease-out, background-color ${ANIM_MS}ms ease-out` : "none";
  // Nur der dunkle Hintergrund blendet aus, das Fenster selbst bleibt voll deckend (Barcode bleibt kontrastreich)
  const dim = 0.45 * Math.max(0, 1 - dy / window.innerHeight);

  return (
    <div
      className="bc"
      style={{ backgroundColor: `rgba(0, 0, 0, ${dim})`, transition: ease }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      role="dialog"
      aria-label="SSCC als Barcode"
      data-testid="barcode-sheet"
    >
      <div
        className={`bc-sheet${wide ? " wide" : ""}`}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: ease }}
        data-testid="barcode-card"
      >
        <div className="bc-handle" />
        <div className={`bc-stage${wide ? " wide" : ""}`}>
          <div className="bc-top">
            <button type="button" className="bc-btn" onClick={() => setWide((w) => !w)} data-testid="barcode-rotate">
              <RotateCw size={18} /> {wide ? "Hochkant" : "Quer (größer)"}
            </button>
            <button type="button" className="bc-btn" onClick={dismiss} aria-label="Schließen" data-testid="barcode-close">
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
            <div className="bc-hint">SSCC · GS1-128 · oben nach unten wischen zum Schließen</div>
          </div>
        </div>
      </div>
    </div>
  );
};
