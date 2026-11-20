import { Share2, Copy, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { toText, toCsv, shareText, copyText, shareCsv } from "@/lib/exportList";

const DONE = { shared: "Geteilt", copied: "In die Zwischenablage kopiert", downloaded: "CSV heruntergeladen", aborted: null };

export const ExportSheet = ({ notes, onClose }) => {
  const run = async (fn) => {
    try {
      const res = await fn();
      if (DONE[res]) toast.success(DONE[res]);
    } catch (e) {
      console.error(e);
      toast.error("Export fehlgeschlagen");
    }
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} data-testid="export-sheet">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">Liste exportieren</h2>
        <p className="sheet-sub">{notes.length} {notes.length === 1 ? "Eintrag" : "Einträge"}</p>
        <button className="sheet-item" onClick={() => run(() => shareText(toText(notes)))} data-testid="export-share-text">
          <Share2 size={20} /> <span>Als Text teilen<small>WhatsApp, Mail, Nachrichten…</small></span>
        </button>
        <button className="sheet-item" onClick={() => run(() => copyText(toText(notes)))} data-testid="export-copy-text">
          <Copy size={20} /> <span>Text kopieren<small>In die Zwischenablage</small></span>
        </button>
        <button className="sheet-item" onClick={() => run(() => shareCsv(toCsv(notes)))} data-testid="export-csv">
          <FileSpreadsheet size={20} /> <span>CSV exportieren<small>Für Excel, eine Zeile pro SSCC</small></span>
        </button>
        <button className="btn ghost full" onClick={onClose} data-testid="export-cancel">Abbrechen</button>
      </div>
    </div>
  );
};
