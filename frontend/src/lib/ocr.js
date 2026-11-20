import { createWorker } from "tesseract.js";
import { createTesseractOcr } from "@/lib/capture";

const abs = (p) => new URL(`${process.env.PUBLIC_URL || ""}${p}`, document.baseURI).href;

let pending = null;

// Lädt die Texterkennung einmalig; alle Dateien liegen lokal (offline-fähig)
export const loadOcr = () => {
  if (pending) return pending;
  pending = createTesseractOcr(
    { createWorker },
    { workerPath: abs("/tess/worker.min.js"), corePath: abs("/tess/core"), langPath: abs("/tess") }
  ).catch((e) => {
    pending = null;
    console.error(e);
    throw new Error("ocr-load");
  });
  return pending;
};
