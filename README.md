# Notizliste

Lager-PWA fürs Smartphone: Paletten-Etiketten scannen (TN + SSCC, bei fehlendem oberen Barcode AN/Reference per Texterkennung), SSCC pro TN sammeln, Optionen und Notizen festhalten, abhaken, exportieren. Alle Daten bleiben auf dem Gerät.

## Struktur

- `frontend/` – React-App (Quellcode, nicht mehr nur das Bundle)
  - `src/components/Scanner.jsx` – Kamera, Barcode (zxing-wasm) + OCR (tesseract.js), live Etikett-Schablone, Taschenlampe
  - `src/lib/capture.js` – Erfassungslogik (Abstimmung über Frames, SSCC-Prüfziffer, AN/Reference-OCR)
  - `src/hooks/useNotes.js` – Liste im `localStorage` (`notizliste.v1`, kompatibel zur alten App)
  - `public/sw.js` – Service Worker, cached App + Scanner-Dateien für Offline-Betrieb
  - `public/zxing`, `public/tess` – selbst gehostete WASM-/Sprachdateien (kein CDN nötig)
- `backend/` – minimaler FastAPI-Health-Endpoint (die App braucht keinen Server)

## Entwicklung

```bash
cd frontend && yarn install && yarn start
```

## Build (z. B. für GitHub Pages)

```bash
cd frontend && yarn build   # Ergebnis in frontend/build, relative Pfade
```
