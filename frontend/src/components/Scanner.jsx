import { useEffect, useRef, useState } from "react";
import { X, Zap, ZapOff, Keyboard } from "lucide-react";
import { readBarcodes } from "@/lib/barcode";
import { loadOcr } from "@/lib/ocr";
import { createCapture } from "@/lib/capture";
import { anchor, refine, matrixFromAnchor, matrixFromPair, defaultMatrix, TN_OFFSET } from "@/lib/overlay";
import { LABEL_TYPE_1, LABEL_TYPE_2 } from "@/lib/overlaySvg";
import { buzz, beep } from "@/lib/feedback";

const FRAME = { w: 0.88, h: 0.62 };
const RE_SSCC = /^00\d{18}$/, RE_TN = /^\d{10}$/;
const clean = (t) => String(t).replace(/[()\s]/g, "");

const cameraError = (e) => {
  if (!navigator.mediaDevices?.getUserMedia) return "Kamera wird in diesem Browser nicht unterstützt (HTTPS erforderlich).";
  if (e?.name === "NotAllowedError") return "Kamerazugriff wurde verweigert. Bitte in den Einstellungen erlauben.";
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "Keine Kamera gefunden.";
  return "Kamera konnte nicht gestartet werden.";
};

export const Scanner = ({ onClose, onLabel, isDuplicate, onManual }) => {
  const videoRef = useRef(null), canvasRef = useRef(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [torch, setTorch] = useState({ available: false, on: false });
  const [z, setZ] = useState({ tn: false, ss: false, ref: false, msg: "", alert: 0 });
  const [ar, setAr] = useState(() => {
    const W = window.innerWidth, H = window.innerHeight;
    return { t: 1, fast: false, m: defaultMatrix(W, H, W * FRAME.w, H * FRAME.h) };
  });
  const st = useRef({ ignore: new Map(), busy: false, done: false, mt: 0, at: 0, ssSince: 0, ssLast: 0, tnLast: 0, arM: null, arT: 0, cur: null, g: null, v: null, now: 0, track: null });
  const cb = useRef({});
  cb.current = { onClose, onLabel, isDuplicate };

  useEffect(() => {
    let stream, timer, stop = false;
    loadOcr().catch(() => {});

    const setArSmooth = (n) => setAr((p) => (p.t === n.t && p.fast === n.fast && p.m.every((q, i) => Math.abs(q - n.m[i]) < 0.01) ? p : n));
    const msg = (m, ms) => {
      setZ((p) => ({ ...p, msg: m }));
      clearTimeout(st.current.mt);
      st.current.mt = setTimeout(() => setZ((p) => ({ ...p, msg: "" })), ms || 2500);
    };

    // Schablone anhand der erkannten Barcode-Positionen ausrichten
    const updateOverlay = (found, g, v, now) => {
      const s = st.current;
      const codes = found.map((c) => ({
        value: clean(c.text),
        pts: c.position ? [c.position.topLeft, c.position.topRight, c.position.bottomRight, c.position.bottomLeft] : null,
      }));
      const ssC = codes.find((c) => RE_SSCC.test(c.value)), tnC = codes.find((c) => RE_TN.test(c.value));
      if (tnC) s.tnLast = now;
      if (ssC) { s.ssSince = s.ssSince || now; s.ssLast = now; }
      else if (s.ssLast && now - s.ssLast > 800) { s.ssSince = 0; s.ssLast = 0; }
      let next = null;
      if (ssC?.pts) {
        const an = refine(v, anchor(ssC.pts, g.ox, g.oy));
        if (tnC?.pts) {
          const at = refine(v, anchor(tnC.pts, g.ox, g.oy));
          next = { t: 1, fast: true, m: matrixFromPair(an.c, at.c, TN_OFFSET, g.offx, g.offy, g.sc) };
        } else {
          next = { t: s.ssSince > 0 && now - s.ssSince >= 350 ? 2 : 1, fast: true, m: matrixFromAnchor(an, false, g.offx, g.offy, g.sc) };
        }
      }
      if (next) {
        const pm = s.arM;
        if (pm && s.arT === next.t && Math.hypot(next.m[4] - pm[4], next.m[5] - pm[5]) < 0.5 * Math.hypot(pm[0], pm[1]) * 1e3 && Math.hypot(next.m[0] - pm[0], next.m[1] - pm[1]) < 0.4 * Math.hypot(pm[0], pm[1])) {
          next.m = next.m.map((q, i) => pm[i] + (q - pm[i]) * 0.6);
        }
        s.arM = next.m; s.arT = next.t;
        setArSmooth(next);
      } else {
        s.arM = null; s.arT = 0;
        setArSmooth({ t: 1, fast: false, m: defaultMatrix(g.cw, g.ch, g.cw * g.fw, g.ch * g.fh) });
      }
      return { ssC, tnC };
    };

    const cap = createCapture({
      readBarcodes: async (img, opts) => {
        const s = st.current;
        const res = await readBarcodes(img, opts);
        const found = res.filter((c) => !(s.ignore.get(clean(c.text)) > Date.now()));
        s.cur = updateOverlay(found, s.g, s.v, s.now);
        return found;
      },
      ocr: async (bild) => (await loadOcr())(bild),
    });

    const finish = (fn) => {
      st.current.done = true;
      setDone(true);
      buzz(1);
      setTimeout(() => { fn(); cb.current.onClose(); }, 120);
    };

    const handle = async (img, g, v, now) => {
      const s = st.current;
      s.g = g; s.v = v; s.now = now; s.cur = { ssC: null, tnC: null };
      const R = await cap.feed(img);
      if (stop || s.done) return;
      const ssC = s.cur.ssC;
      if (R.fertig) {
        const pair = [R.tn, R.ssc];
        cap.reset();
        s.ssSince = 0;
        s.ignore.set(R.tn, now + 1500);
        s.ignore.set(R.ssc, now + 4000);
        setZ((p) => ({ ...p, tn: false, ss: false, ref: false }));
        if (cb.current.isDuplicate(pair)) {
          buzz(2); beep();
          setZ((p) => ({ ...p, alert: p.alert + 1 }));
          clearTimeout(s.at);
          s.at = setTimeout(() => setZ((p) => ({ ...p, alert: 0 })), 1400);
          msg("Diese SSCC ist schon in der Liste", 2200);
          return;
        }
        finish(() => cb.current.onLabel(R.tn, R.ssc, R.typ === 2 ? R.an : undefined));
        return;
      }
      const refPhase = !!ssC && now - s.tnLast > 1500 && s.ssSince > 0 && now - s.ssSince >= 350;
      setZ((p) => (p.tn === !!R.tn && p.ss === !!R.ssc && p.ref === refPhase ? p : { ...p, tn: !!R.tn, ss: !!R.ssc, ref: refPhase }));
      if (refPhase && (R.an || R.tn)) msg(`Kein oberer Barcode – lese AN und Reference… (AN ${R.an ? "✓" : "…"} · Reference ${R.tn ? "✓" : "…"})`, 3000);
    };

    const tick = async () => {
      const v = videoRef.current, c = canvasRef.current, s = st.current;
      if (!stop && !s.busy && !s.done && v && v.readyState >= 2 && v.videoWidth) {
        s.busy = true;
        try {
          const vw = v.videoWidth, vh = v.videoHeight, cw = v.clientWidth, ch = v.clientHeight;
          const sc = Math.max(cw / vw, ch / vh), w = (cw * FRAME.w) / sc, h = (ch * FRAME.h) / sc, x = (vw - w) / 2, y = (vh - h) / 2;
          c.width = w; c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(v, x, y, w, h, 0, 0, c.width, c.height);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          if (!stop) await handle(img, { ox: x, oy: y, sc, offx: (cw - vw * sc) / 2, offy: (ch - vh * sc) / 2, cw, ch, fw: FRAME.w, fh: FRAME.h }, v, Date.now());
        } catch (ex) {
          console.error(ex);
          if (ex?.message === "ocr-load") msg("Texterkennung konnte nicht geladen werden", 3000);
        }
        s.busy = false;
      }
      if (!stop) timer = setTimeout(tick, 30);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        const track = stream.getVideoTracks()[0];
        st.current.track = track;
        if (track.getCapabilities?.().torch) setTorch({ available: true, on: false });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        tick();
      } catch (ex) {
        setError(cameraError(ex));
      }
    })();

    return () => {
      stop = true;
      clearTimeout(timer);
      clearTimeout(st.current.mt);
      clearTimeout(st.current.at);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const on = !torch.on;
    try {
      await st.current.track?.applyConstraints({ advanced: [{ torch: on }] });
      setTorch((t) => ({ ...t, on }));
    } catch (e) {
      console.error(e);
    }
  };

  const found = (z.tn ? 1 : 0) + (z.ss ? 1 : 0);
  const hint = error ? null : done ? "Erkannt ✓" : z.msg || (z.ref ? "Kein oberer Barcode – lese AN und Reference…" : `TN (oben) und SSCC (unten) in den Rahmen halten (${found}/2)`);

  return (
    <div className="scanner" data-testid="scanner-modal">
      <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
      <canvas ref={canvasRef} hidden />
      <div className={`scan-frame ${done ? "is-done" : ""}`} style={{ width: `${FRAME.w * 100}%`, height: `${FRAME.h * 100}%` }} data-testid="scanner-frame" />
      <svg className="scan-ar" aria-hidden data-testid="scanner-overlay">
        <g
          className="scan-ar-g"
          data-type={ar.t}
          style={{ transform: `matrix(${ar.m.join(",")})`, transition: ar.fast ? "transform .09s linear" : "transform .35s ease-out" }}
          dangerouslySetInnerHTML={{ __html: ar.t === 2 ? LABEL_TYPE_2 : LABEL_TYPE_1 }}
        />
      </svg>
      {z.alert > 0 && <div key={z.alert} className="scan-alert" data-testid="scanner-alert" />}

      <div className="scanner-top">
        <div className="mode-switch" data-testid="scanner-mode-switch">
          <button className="active" tabIndex={-1}>Etikett · automatisch</button>
        </div>
        <div className="scanner-actions">
          {torch.available && (
            <button className="scanner-round" onClick={toggleTorch} aria-label="Taschenlampe" data-testid="scanner-torch-button">
              {torch.on ? <ZapOff size={20} /> : <Zap size={20} />}
            </button>
          )}
          <button className="scanner-round" onClick={onClose} aria-label="Schließen" data-testid="scanner-close-button">
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="scanner-bottom">
        <div className="scanner-hint" data-testid="scanner-hint">
          {error ? <span className="scanner-error" data-testid="scanner-error">{error}</span> : hint}
        </div>
        <button className="scanner-manual" onClick={onManual} data-testid="scanner-manual-button">
          <Keyboard size={18} /> Manuell eingeben
        </button>
      </div>
    </div>
  );
};
