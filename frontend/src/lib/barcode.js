import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

const base = process.env.PUBLIC_URL || "";

prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith(".wasm") ? `${base}/zxing/${path}` : prefix + path),
  },
  fireImmediately: true,
});

export { readBarcodes };
