import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { unlockAudio } from "@/lib/feedback";
import { loadOcr } from "@/lib/ocr";

unlockAudio();

// Texterkennung im Leerlauf vorladen, damit der erste Scan nicht darauf warten muss
window.addEventListener("load", () => setTimeout(() => loadOcr().catch(() => {}), 2500));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/sw.js`).catch((e) => console.error("SW", e));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

