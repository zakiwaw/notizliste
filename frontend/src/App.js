import { useState } from "react";
import "@/App.css";
import { Plus, ScanBarcode, Keyboard, Share2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useNotes } from "@/hooks/useNotes";
import { Scanner } from "@/components/Scanner";
import { NotePage } from "@/components/NotePage";
import { NoteItem } from "@/components/NoteItem";
import { ManualEntry } from "@/components/ManualEntry";
import { BarcodeSheet } from "@/components/BarcodeSheet";
import { ExportSheet } from "@/components/ExportSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { uid } from "@/lib/notes";

export default function App() {
  const n = useNotes();
  const [text, setText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [notePage, setNotePage] = useState(null);
  const [barcode, setBarcode] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const hasCompleted = n.notes.some((x) => x.completed || Object.values(x.ssccDone || {}).some(Boolean));

  const withUndo = (message, mutate) => {
    const snapshot = n.notes;
    mutate();
    toast(message, { action: { label: "Rückgängig", onClick: () => n.replaceAll(snapshot) }, duration: 6000 });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    n.add({ text: text.trim() });
    setText("");
  };

  const onLabel = (tn, sscc, an) => {
    const existing = n.findByTn(tn);
    if (existing) {
      n.addSscc(tn, sscc, an);
      toast.success(`SSCC zu TN ${tn} hinzugefügt`);
      setNotePage({ id: existing.id, code: sscc });
    } else {
      const id = uid();
      n.add({ id, text: tn, type: "label", rawCodes: [tn, sscc], ...(an ? { an } : {}) });
      setNotePage({ id, code: sscc });
    }
  };

  const onManualSubmit = (tn, sscc, an) => {
    if (n.hasCodes([tn, sscc])) return toast.error("Diese SSCC ist schon in der Liste");
    setManual(false);
    onLabel(tn, sscc, an);
  };

  const pageNote = notePage && n.notes.find((x) => x.id === notePage.id);

  return (
    <div className="app">
      <header className="app-header">
        <h1 data-testid="app-title">Notizliste</h1>
        <div className="header-actions">
          <button className="text-btn" onClick={() => setExporting(true)} disabled={!n.notes.length} aria-label="Exportieren" data-testid="export-button">
            <Share2 size={18} /> Teilen
          </button>
          <button className="text-btn danger" onClick={() => setConfirmClear(true)} disabled={!hasCompleted} data-testid="delete-completed-button">
            Erledigte löschen
          </button>
        </div>
      </header>

      <form className="composer" onSubmit={submit} data-testid="note-form">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Neue Notiz…" enterKeyHint="done" data-testid="note-input" />
        <button type="submit" className="icon-btn add" aria-label="Hinzufügen" data-testid="add-note-button"><Plus size={24} strokeWidth={2.5} /></button>
        <button type="button" className="icon-btn manual" onClick={() => setManual(true)} aria-label="Manuell eingeben" data-testid="open-manual-button"><Keyboard size={22} /></button>
        <button type="button" className="icon-btn scan" onClick={() => setScanning(true)} aria-label="Scannen" data-testid="open-scanner-button"><ScanBarcode size={22} /></button>
      </form>

      {n.notes.length === 0 ? (
        <p className="empty" data-testid="empty-state">Noch keine Einträge.<br /><small>Etikett scannen, manuell eingeben oder eine Notiz schreiben.</small></p>
      ) : (
        <ul className="notes" data-testid="note-list">
          {n.notes.map((x) => (
            <NoteItem
              key={x.id}
              note={x}
              onToggle={n.toggle}
              onRemove={(id) => withUndo("Eintrag gelöscht", () => n.remove(id))}
              onEditSscc={(id, code) => setNotePage({ id, code })}
              onToggleSscc={n.toggleSscc}
              onShowSscc={setBarcode}
            />
          ))}
        </ul>
      )}

      {scanning && (
        <Scanner
          onClose={() => setScanning(false)}
          onLabel={onLabel}
          isDuplicate={n.hasCodes}
          onManual={() => { setScanning(false); setManual(true); }}
        />
      )}
      {manual && <ManualEntry onSubmit={onManualSubmit} onClose={() => setManual(false)} />}
      {pageNote && (
        <NotePage
          key={notePage.id + notePage.code}
          note={pageNote}
          code={notePage.code}
          onSave={(opts, txt) => { n.setSsccOpts(notePage.id, notePage.code, opts); n.setSsccNote(notePage.id, notePage.code, txt); }}
          onClose={() => setNotePage(null)}
        />
      )}
      {barcode && <BarcodeSheet code={barcode} onClose={() => setBarcode(null)} />}
      {exporting && <ExportSheet notes={n.notes} onClose={() => setExporting(false)} />}
      {confirmClear && (
        <ConfirmDialog
          title="Erledigte löschen?"
          text="Alle erledigten Einträge und abgehakten SSCC werden entfernt. Du kannst das kurz danach rückgängig machen."
          confirmLabel="Löschen"
          onConfirm={() => withUndo("Erledigte gelöscht", n.clearCompleted)}
          onClose={() => setConfirmClear(false)}
        />
      )}
      <Toaster position="top-center" theme="system" richColors />
    </div>
  );
}
