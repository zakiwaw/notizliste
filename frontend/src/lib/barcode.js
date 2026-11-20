import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

const base = process.env.PUBLIC_URL || "";

prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith(".wasm") ? `${base}/zxing/${path}` : prefix + path),
  },
  fireImmediately: true,
});

let skipHard = false;

// Erst ein schneller Durchlauf; der gründliche nur, wenn noch etwas fehlt und er zuletzt mehr gefunden hat
export const readBarcodesFast = async (img, opts, complete) => {
  const fast = await readBarcodes(img, { ...opts, tryHarder: false, tryDownscale: false });
  if (complete(fast)) return fast;
  if (fast.length && skipHard) {
    skipHard = false;
    return fast;
  }
  const hard = await readBarcodes(img, opts);
  const seen = new Set(fast.map((c) => c.text));
  skipHard = !hard.some((c) => !seen.has(c.text));
  const got = new Set(hard.map((c) => c.text));
  return [...hard, ...fast.filter((c) => !got.has(c.text))];
};

export { readBarcodes };
