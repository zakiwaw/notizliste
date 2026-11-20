// Geometrie für die live mitlaufende Etikett-Schablone (rastet auf den SSCC-/TN-Barcode ein)
const ctx2d = (cv) => cv.getContext("2d", { willReadFrequently: true });

const normalize = (cv) => {
  const w = cv.width, h = cv.height, x = ctx2d(cv), d = x.getImageData(0, 0, w, h), p = d.data;
  const hist = new Array(256).fill(0), n = w * h;
  for (let i = 0; i < p.length; i += 4) {
    const g = ((p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1e3) | 0;
    p[i] = g;
    hist[g]++;
  }
  let acc = 0, lo = 0, hi = 255;
  for (let g = 0; g < 256; g++) { acc += hist[g]; if (acc >= n * 0.02) { lo = g; break; } }
  acc = 0;
  for (let g = 255; g >= 0; g--) { acc += hist[g]; if (acc >= n * 0.02) { hi = g; break; } }
  const sp = Math.max(hi - lo, 1);
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((p[i] - lo) * 255) / sp));
    p[i] = p[i + 1] = p[i + 2] = v;
    p[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return cv;
};

const warp = (src, an, du, dv0, dv1, ppb, flip) => {
  const f = flip ? -1 : 1;
  const eu = [f * Math.cos(an.a), f * Math.sin(an.a)], ev = [-f * Math.sin(an.a), f * Math.cos(an.a)];
  const W = Math.max(1, Math.round(2 * du * ppb)), H = Math.max(1, Math.round((dv1 - dv0) * ppb)), sc = ppb / an.bw;
  const o = document.createElement("canvas");
  o.width = W; o.height = H;
  const x = ctx2d(o);
  x.fillStyle = "#fff";
  x.fillRect(0, 0, W, H);
  x.imageSmoothingQuality = "high";
  const cu = an.c[0] * eu[0] + an.c[1] * eu[1], cw = an.c[0] * ev[0] + an.c[1] * ev[1];
  x.setTransform(sc * eu[0], sc * ev[0], sc * eu[1], sc * ev[1], sc * (du * an.bw - cu), sc * (-cw - dv0 * an.bw));
  x.drawImage(src, 0, 0);
  return normalize(o);
};

export const anchor = (pts, ox, oy) => {
  const P = pts.map((p) => [p.x + ox, p.y + oy]);
  const d = (i, j) => Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]);
  const l0 = (d(0, 1) + d(2, 3)) / 2, l1 = (d(1, 2) + d(3, 0)) / 2, k = l0 >= l1 ? 0 : 1;
  const a = P[k], b = P[(k + 1) % 4];
  return {
    c: [(P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4],
    a: Math.atan2(b[1] - a[1], b[0] - a[0]),
    bw: Math.max(l0, l1),
  };
};

const energy = (cv) => {
  const w = cv.width, h = cv.height, d = ctx2d(cv).getImageData(0, 0, w, h).data;
  let e = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) { const i = (y * w + x) * 4; e += Math.abs(d[i] - d[i + 4]); }
  return e / (w * h);
};

const vertical = (v, an) => {
  const ppb = 200, cv = warp(v, an, 0.4, -0.6, 0.6, ppb, false), w = cv.width, h = cv.height;
  const d = ctx2d(cv).getImageData(0, 0, w, h).data, E = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    let e = 0;
    for (let x = 0; x < w - 1; x++) { const i = (y * w + x) * 4; e += Math.abs(d[i] - d[i + 4]); }
    E[y] = e;
  }
  const S = E.map((_, y) => {
    let s = 0, n = 0;
    for (let k = -2; k <= 2; k++) { const q = E[y + k]; if (q !== undefined) { s += q; n++; } }
    return s / n;
  });
  let m = 0, mi = -1;
  for (let y = Math.round(0.15 * h); y < Math.round(0.85 * h); y++) if (S[y] > m) { m = S[y]; mi = y; }
  if (mi < 0 || m < 6 * w) return null;
  const thr = 0.45 * m;
  let t = mi, u = mi;
  while (t > 0 && S[t - 1] > thr) t--;
  while (u < h - 1 && S[u + 1] > thr) u++;
  return -0.6 + ((t + u) / 2 + 0.5) / ppb;
};

const shift = (an, vc) => {
  const ev = [-Math.sin(an.a), Math.cos(an.a)];
  return { c: [an.c[0] + vc * an.bw * ev[0], an.c[1] + vc * an.bw * ev[1]], a: an.a, bw: an.bw };
};

export const refine = (v, an) => {
  let cur = an, ok = false;
  const v1 = vertical(v, cur);
  if (v1 !== null) { cur = shift(cur, v1); ok = true; }
  let best = cur.a, be = -1;
  const tryAngle = (a) => {
    const e = energy(warp(v, { c: cur.c, a, bw: cur.bw }, 0.45, -0.08, 0.08, 160, false));
    if (e > be) { be = e; best = a; }
  };
  for (let k = -4; k <= 4; k++) tryAngle(cur.a + (k * 5 * Math.PI) / 180);
  const b0 = best;
  tryAngle(b0 - (2.5 * Math.PI) / 180);
  tryAngle(b0 + (2.5 * Math.PI) / 180);
  cur = { c: cur.c, a: best, bw: cur.bw };
  const v2 = vertical(v, cur);
  if (v2 !== null) { cur = shift(cur, v2); ok = true; }
  return { c: cur.c, a: cur.a, bw: cur.bw, ok };
};

export const matrixFromAnchor = (an, flip, ox, oy, sc) => {
  const f = flip ? -1 : 1, s = (sc * an.bw) / 1e3;
  const eu = [f * Math.cos(an.a), f * Math.sin(an.a)], ev = [-f * Math.sin(an.a), f * Math.cos(an.a)];
  return [s * eu[0], s * eu[1], s * ev[0], s * ev[1], sc * an.c[0] + ox, sc * an.c[1] + oy];
};

export const matrixFromPair = (d1, d2, g2, ox, oy, sc) => {
  const dx = d2[0] - d1[0], dy = d2[1] - d1[1];
  const s = Math.hypot(dx, dy) / Math.hypot(g2[0], g2[1]), th = Math.atan2(dy, dx) - Math.atan2(g2[1], g2[0]);
  const k = sc * s, co = Math.cos(th), si = Math.sin(th);
  return [k * co, k * si, -k * si, k * co, sc * d1[0] + ox, sc * d1[1] + oy];
};

export const defaultMatrix = (cw, ch, fw, fh) => {
  const s = Math.min(fw / 1656, fh / 2377);
  return [s, 0, 0, s, cw / 2 + 74 * s, ch / 2 + 518.5 * s];
};

// Abstand TN-Barcode → SSCC-Barcode in Schablonen-Einheiten (Typ 1)
export const TN_OFFSET = [-82.8, -1276.2];
