// capture.js – Etiketten-Erfassung (TN / SSCC / AN) für die Notizliste.
// Keine festen Abhängigkeiten: zxing-wasm `readBarcodes` und eine OCR-Funktion werden übergeben.
//
// Einbau in die Scanner-Komponente:
// 1. import { createCapture, createTesseractOcr } from './capture.js';  (readBarcodes aus 'zxing-wasm/reader', Tesseract = tesseract.js 5)
// 2. Einmal beim Start der Kamera: const cap = createCapture({ readBarcodes, ocr: await createTesseractOcr(Tesseract) });
// 3. Im bestehenden ~120-ms-Takt: const r = await cap.feed(videoElement);  (ganzer Frame in voller Auflösung; nächsten Aufruf erst nach dem await)
// 4. Wenn r.fertig: r.typ / r.tn / r.ssc / r.an übernehmen (r.konfidenz 0..1), danach cap.reset() für das nächste Etikett.
// 5. Alte Logik (Zeichenkorrektur O→0 usw., eigene 2-Lesungen-Regel, 180°-Flip) für diese Werte entfernen, das macht capture.js.

const CONFIG = {
  stimmen: 2,          // gleiche Lesungen für Text (AN/Reference)
  stimmenBarcode: 1,   // Barcodes sind per Prüfzeichen/Prüfziffer abgesichert
  fenster: 8,          // so viele letzte Lesungen zählen
  mehrheit: 0.6,       // Mindestanteil des Siegers (pro Wert bzw. pro Ziffernposition)
  ocrNachFrames: 1,    // Typ-2-Texterkennung erst nach so vielen Frames ohne oberen Barcode
  // Textzonen relativ zur SSCC-Barcodebreite W (dx/dy = Mitte, w/h = Größe, px = Pixel pro W im Crop)
  zonen: {
    // th = erwartete Schrifthöhe; die Textzeile wird innerhalb der (großzügigen) Zone gesucht
    an:  { dx: 0.02, dy: -1.535, w: 0.86, h: 0.40, th: 0.143, px: 300 },
    ref: { dx: 0.02, dy: -0.966, w: 0.66, h: 0.26, th: 0.08, px: 560 },
  },
  zxing: {
    formats: ['Code128', 'Code39'], tryHarder: true, tryRotate: false, tryInvert: false,
    tryDownscale: true, maxNumberOfSymbols: 4, textMode: 'Plain',
  },
};

const RE_TN = /^\d{10}$/, RE_SSCC = /^00\d{18}$/, RE_AN = /^D\d{7}$/;

// GS1 Modulo 10 über die 18 SSCC-Ziffern (ohne AI "00").
export function ssccGueltig(s) {
  if (!RE_SSCC.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += +s[2 + i] * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === +s[19];
}

// Abstimmung über mehrere Frames; proPosition=true stimmt jede Ziffernstelle einzeln ab.
class Abstimmung {
  constructor(proPosition, pruefe, stimmen) { this.pp = proPosition; this.ok = pruefe; this.l = []; this.st = stimmen; }
  add(v) { this.l.push(v); if (this.l.length > CONFIG.fenster) this.l.shift(); }
  get() {
    const n = this.l.length;
    if (n < this.st) return null;
    const sieger = (werte) => {
      const z = {};
      for (const w of werte) z[w] = (z[w] || 0) + 1;
      const [wert, c] = Object.entries(z).sort((a, b) => b[1] - a[1])[0];
      return c >= this.st && c / n >= CONFIG.mehrheit ? { wert, c } : null;
    };
    let wert, min = n;
    if (this.pp) {
      wert = '';
      for (let p = 0; p < this.l[0].length; p++) {
        const s = sieger(this.l.map((x) => x[p]));
        if (!s) return null;
        wert += s.wert; min = Math.min(min, s.c);
      }
    } else {
      const s = sieger(this.l);
      if (!s) return null;
      wert = s.wert; min = s.c;
    }
    if (!this.ok(wert)) return null;
    return { wert, konfidenz: (min / n) * Math.min(1, min / 3) };
  }
}

function toImageData(q) {
  if (q && q.data && q.width) return q;
  const w = q.videoWidth || q.width, h = q.videoHeight || q.height;
  const c = toImageData.c || (toImageData.c = document.createElement('canvas'));
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(q, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// Gedrehten Ausschnitt als Graustufenbild holen (bilinear), u = Leserichtung, v = nach unten im Etikett.
function warp(img, cx, cy, ux, uy, zone, W) {
  const ow = Math.round(zone.w * zone.px), oh = Math.round(zone.h * zone.px);
  const g = new Float32Array(ow * oh), vx = -uy, vy = ux, k = W / zone.px;
  const { data, width, height } = img;
  const mx = cx + (zone.dx * ux + zone.dy * vx) * W, my = cy + (zone.dx * uy + zone.dy * vy) * W;
  for (let j = 0; j < oh; j++) for (let i = 0; i < ow; i++) {
    const s = (i - ow / 2) * k, t = (j - oh / 2) * k;
    const x = mx + s * ux + t * vx, y = my + s * uy + t * vy;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < 0 || y0 < 0 || x0 >= width - 1 || y0 >= height - 1) { g[j * ow + i] = 255; continue; }
    const fx = x - x0, fy = y - y0, o = (y0 * width + x0) * 4;
    const gr = (p) => 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    g[j * ow + i] = (gr(o) * (1 - fx) + gr(o + 4) * fx) * (1 - fy)
      + (gr(o + width * 4) * (1 - fx) + gr(o + width * 4 + 4) * fx) * fy;
  }
  return { g, w: ow, h: oh };
}

// Schärfen (Unsharp 3x3) + adaptive Schwelle (Bradley, Integralbild) + Textzeile ausschneiden -> RGBA.
// soll = erwartete Schrifthöhe in Pixeln; ohne passende Zeile -> null.
function vorverarbeiten({ g, w, h }, soll) {
  const s = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!x || !y || x === w - 1 || y === h - 1) { s[i] = g[i]; continue; }
    const m = (g[i - 1] + g[i + 1] + g[i - w] + g[i + w]) / 4;
    s[i] = g[i] + 1.0 * (g[i] - m);
  }
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let r = 0;
    for (let x = 0; x < w; x++) { r += s[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + r; }
  }
  const R = Math.max(8, Math.round(soll)), bin = new Uint8Array(w * h), zeile = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
    const mean = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    if (s[y * w + x] < mean * 0.82) { bin[y * w + x] = 1; zeile[y] += 1 / w; }
  }
  // Textband suchen: Zeilen mit Tinte, aber keine Rahmenlinien (>85 % Tinte); Höhe nahe an soll, möglichst mittig
  let best = null;
  for (let y = 0, a = -1; y <= h; y++) {
    const text = y < h && zeile[y] > 0.03 && zeile[y] < 0.85;
    if (text && a < 0) a = y;
    if (!text && a >= 0) {
      const hoehe = y - a, d = Math.abs((a + y) / 2 - h / 2);
      if (hoehe > soll * 0.6 && hoehe < soll * 1.5 && (!best || d < best.d)) best = { a, b: y, d };
      a = -1;
    }
  }
  if (!best) return null;
  const pad = 14, bh = best.b - best.a, W2 = w + 2 * pad, H2 = bh + 2 * pad;
  const out = new Uint8ClampedArray(W2 * H2 * 4).fill(255);
  for (let y = 0; y < bh; y++) for (let x = 0; x < w; x++) if (bin[(y + best.a) * w + x]) {
    const o = ((y + pad) * W2 + x + pad) * 4;
    out[o] = out[o + 1] = out[o + 2] = 0;
  }
  return { data: out, width: W2, height: H2 };
}

// zxing liefert bei schrägen Barcodes nur eine waagerechte Scanlinie. Hier: echte Richtung (Strukturtensor
// der Balkenkanten), echte Breite und echte Mitte (Balkenhöhe abtasten) bestimmen.
function barcodeLage(img, P) {
  const { data, width, height } = img;
  const G = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return 128;
    const o = (y * width + x) * 4;
    return 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  };
  let cx = (P.topLeft.x + P.topRight.x + P.bottomLeft.x + P.bottomRight.x) / 4;
  let cy = (P.topLeft.y + P.topRight.y + P.bottomLeft.y + P.bottomRight.y) / 4;
  let ux = (P.topRight.x - P.topLeft.x + P.bottomRight.x - P.bottomLeft.x) / 2;
  let uy = (P.topRight.y - P.topLeft.y + P.bottomRight.y - P.bottomLeft.y) / 2;
  let W = Math.hypot(ux, uy);
  ux /= W; uy /= W;
  // Winkel suchen: Projektion entlang der Balken ist bei richtigem Winkel am schärfsten
  const a0 = Math.atan2(uy, ux), W0 = W;
  let best = -1, bw = a0;
  const schaerfe = (w) => {
    const c = Math.cos(w), sn = Math.sin(w);
    let prev = null, e = 0;
    for (let s = -0.42 * W0; s <= 0.42 * W0; s++) {
      let p = 0;
      for (let t = -0.03 * W0; t <= 0.03 * W0; t += 2) p += G(cx + s * c - t * sn, cy + s * sn + t * c);
      if (prev !== null) e += (p - prev) ** 2;
      prev = p;
    }
    return e;
  };
  for (const [von, bis, schritt] of [[-24, 24, 2], [-2, 2, 0.25]]) {
    const mitte = bw;
    for (let d = von; d <= bis; d += schritt) {
      const w = mitte + (d * Math.PI) / 180, e = schaerfe(w);
      if (e > best) { best = e; bw = w; }
    }
  }
  ux = Math.cos(bw); uy = Math.sin(bw);
  W = W0 * Math.cos(bw - a0);
    const kontrast = (t) => {
    let n = 0, a = 0, q = 0;
    for (let s = -0.4 * W; s <= 0.4 * W; s += 2) { const g = G(cx + s * ux - t * uy, cy + s * uy + t * ux); n++; a += g; q += g * g; }
    return Math.sqrt(Math.max(0, q / n - (a / n) ** 2));
  };
  const k0 = kontrast(0), rand = (r) => {
    let t = 0;
    while (Math.abs(t) < 0.6 * W && kontrast(t + r * 0.01 * W) > 0.6 * k0) t += r * 0.01 * W;
    return t;
  };
  const m = (rand(-1) + rand(1)) / 2;
  cx -= m * uy; cy += m * ux;
  return { cx, cy, ux, uy, W };
}

/**
 * createCapture({ readBarcodes, ocr })
 *   readBarcodes: aus 'zxing-wasm/reader'
 *   ocr: async (imageData) => string   (siehe createTesseractOcr)
 * feed(canvas | video | ImageData) -> { typ, tn, ssc, an, konfidenz, fertig }
 */
export function createCapture({ readBarcodes, ocr, debug }) {
  let v, ohneTn, flip, ocrLaeuft;
  const reset = () => {
    v = {
      ssc: new Abstimmung(false, ssccGueltig, CONFIG.stimmenBarcode),
      tn: new Abstimmung(false, (x) => RE_TN.test(x), CONFIG.stimmenBarcode),
      an: new Abstimmung(true, (x) => RE_AN.test(x), CONFIG.stimmen),
      ref: new Abstimmung(true, (x) => RE_TN.test(x), CONFIG.stimmen),
    };
    ohneTn = 0; flip = false; ocrLaeuft = false;
  };
  reset();

  async function leseText(img, pos) {
    const geo = barcodeLage(img, pos);
    let { cx, cy, ux, uy, W } = geo;
    if (W < 80) return; // Barcode zu klein im Bild -> Text nicht lesbar
    if (flip) { ux = -ux; uy = -uy; }
    const lies = async (name) => {
      const z = CONFIG.zonen[name], bild = vorverarbeiten(warp(img, cx, cy, ux, uy, z, W), z.th * z.px);
      if (!bild) return '';
      if (debug) debug(name, bild);
      return (await ocr(bild)).replace(/\s/g, '');
    };
    // Bereits sicher gelesene Zone nicht erneut erkennen (halbiert die OCR-Zeit pro Frame)
    const anFest = !!v.an.get(), refFest = !!v.ref.get();
    const an = anFest ? '' : await lies('an'), ref = refFest ? '' : await lies('ref');
    const anOk = RE_AN.test(an), refOk = RE_TN.test(ref);
    if (anOk) v.an.add(an);
    if (refOk) v.ref.add(ref);
    if (!anOk && !refOk && !anFest && !refFest) flip = !flip; // 180°-Rückfall, falls die Barcode-Richtung nicht stimmt
  }

  async function feed(quelle) {
    const img = toImageData(quelle);
    const codes = await readBarcodes(img, CONFIG.zxing);
    let sscc = null, tn = null;
    for (const c of codes) {
      if (c.isValid === false) continue;
      const t = c.text.replace(/[()\s]/g, '');
      if (ssccGueltig(t)) sscc = { text: t, position: c.position };
      else if (RE_TN.test(t)) tn = { text: t };
    }
    if (sscc) v.ssc.add(sscc.text);
    if (tn) { v.tn.add(tn.text); ohneTn = 0; } else if (sscc) ohneTn++;

    if (ocr && sscc && !tn && !v.tn.get() && ohneTn >= CONFIG.ocrNachFrames && !ocrLaeuft
      && !(v.an.get() && v.ref.get())) {
      ocrLaeuft = true;
      try { await leseText(img, sscc.position); } finally { ocrLaeuft = false; }
    }
    return ergebnis();
  }

  function ergebnis() {
    const ssc = v.ssc.get(), tn = v.tn.get(), an = v.an.get(), ref = v.ref.get();
    const k = (...x) => Math.round(Math.min(...x.map((y) => y.konfidenz)) * 100) / 100;
    if (ssc && tn) return { typ: 1, tn: tn.wert, ssc: ssc.wert, an: null, konfidenz: k(ssc, tn), fertig: true };
    if (ssc && an && ref) return { typ: 2, tn: ref.wert, ssc: ssc.wert, an: an.wert, konfidenz: k(ssc, an, ref), fertig: true };
    return { typ: null, tn: (tn || ref || {}).wert || null, ssc: ssc ? ssc.wert : null, an: an ? an.wert : null, konfidenz: 0, fertig: false };
  }

  return { feed, reset };
}

// Browser-Adapter für tesseract.js 5: ein Worker, nur Ziffern + D, eine Textzeile.
export async function createTesseractOcr(Tesseract, options) {
  const worker = await Tesseract.createWorker('eng', 1, options);
  await worker.setParameters({ tessedit_char_whitelist: '0123456789D', tessedit_pageseg_mode: '7' });
  const c = document.createElement('canvas');
  return async (bild) => {
    c.width = bild.width; c.height = bild.height;
    c.getContext('2d').putImageData(new ImageData(bild.data, bild.width, bild.height), 0, 0);
    return (await worker.recognize(c)).data.text;
  };
}

