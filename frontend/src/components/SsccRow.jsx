import { Pencil } from "lucide-react";

export const SsccRow = ({ code, text, opts, done, onToggle, onEdit }) => {
  const stop = (e) => e.stopPropagation();
  return (
    <span className={`note-child${done ? " sn-is-done" : ""}`} onClick={stop} data-testid={`sscc-row-${code}`}>
      <span className="sn-row">
        <button
          type="button"
          className={`sn-done${done ? " on" : ""}`}
          aria-label={done ? "Als offen markieren" : "Als erledigt markieren"}
          data-testid={`sscc-done-${code}`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {done ? "✓" : ""}
        </button>
        <em>SSCC</em>
        <span className="sn-code">{code}</span>
        <button
          type="button"
          className={`sn-btn${text || opts?.length ? " has" : ""}`}
          aria-label={text ? "Notiz bearbeiten" : "Notiz hinzufügen"}
          data-testid={`sscc-note-btn-${code}`}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil size={15} />
        </button>
      </span>
      {opts?.length ? (
        <span className="sn-tags">
          {opts.map((o) => <span key={o} className="sn-tag">{o}</span>)}
        </span>
      ) : null}
      {text ? <span className="sn-text" onClick={(e) => { e.stopPropagation(); onEdit(); }}>{text}</span> : null}
    </span>
  );
};
