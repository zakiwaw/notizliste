import { useState } from "react";
import { OPTIONS } from "@/lib/notes";

export const NotePage = ({ note, code, onSave, onClose }) => {
  const [sel, setSel] = useState((note.ssccOpts || {})[code] || []);
  const [text, setText] = useState((note.ssccNotes || {})[code] || "");
  const [open, setOpen] = useState(true);

  const toggleOpt = (o) => setSel((p) => (p.includes(o) ? p.filter((q) => q !== o) : [...p, o]));
  const save = () => { onSave(sel, text.trim()); onClose(); };

  return (
    <div className="np" data-testid="note-page">
      <div className="np-top">
        <button type="button" className="np-back" onClick={onClose} data-testid="np-skip">‹ Überspringen</button>
        <h2 className="np-title">Notiz</h2>
      </div>
      <div className="np-codes" data-testid="np-codes">
        {note.an && <div><em>AN</em>{note.an}</div>}
        <div><em>TN</em>{note.rawCodes[0]}</div>
        <div><em>SSCC</em>{code}</div>
      </div>
      <div className="np-label">Warum sammelst du diese SSCC?</div>
      <div className="np-select">
        <button type="button" className="np-sel-head" onClick={() => setOpen(!open)} data-testid="np-select-head">
          <span>{sel.length ? `${sel.length} ausgewählt` : "Option wählen"}</span>
          <span className={`np-chev${open ? " up" : ""}`} />
        </button>
        {open && (
          <div className="np-opts">
            {OPTIONS.map((o) => (
              <label key={o} className={`np-opt${sel.includes(o) ? " on" : ""}`}>
                <input type="checkbox" checked={sel.includes(o)} onChange={() => toggleOpt(o)} data-testid={`np-opt-${o}`} />
                <span className="np-box" />
                <span>{o}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <input
        className="np-text"
        value={text}
        maxLength={200}
        placeholder="Eigene Notiz (optional)"
        enterKeyHint="done"
        data-testid="np-text"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      />
      <button type="button" className="np-save" onClick={save} data-testid="np-save">Speichern</button>
    </div>
  );
};
