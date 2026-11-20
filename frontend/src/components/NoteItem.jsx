import { X } from "lucide-react";
import { SsccRow } from "@/components/SsccRow";
import { ssccList, isSsccDone } from "@/lib/notes";

export const NoteItem = ({ note, onToggle, onRemove, onEditSscc, onToggleSscc }) => {
  const isLabel = note.type === "label";
  const Body = isLabel ? "div" : "button";
  return (
    <li className={`note ${note.completed ? "done" : ""}`} data-testid={`note-item-${note.id}`}>
      <Body
        className="note-body"
        role={isLabel ? "button" : undefined}
        tabIndex={isLabel ? 0 : undefined}
        onClick={() => onToggle(note.id)}
        data-testid={`note-toggle-${note.id}`}
      >
        {isLabel ? (
          <span className="note-codes">
            {note.an && <span className="note-an"><em>AN</em>{note.an}</span>}
            <span className="note-tn"><em>TN</em>{note.rawCodes[0]}</span>
            {ssccList(note).map((c) => (
              <SsccRow
                key={c}
                code={c}
                text={(note.ssccNotes || {})[c]}
                opts={(note.ssccOpts || {})[c]}
                done={isSsccDone(note, c)}
                onToggle={() => onToggleSscc(note.id, c)}
                onEdit={() => onEditSscc(note.id, c)}
              />
            ))}
          </span>
        ) : (
          <span className="note-text">{note.text}</span>
        )}
      </Body>
      <button className="note-delete" onClick={() => onRemove(note.id)} aria-label="Löschen" data-testid={`note-delete-${note.id}`}>
        <X size={18} />
      </button>
    </li>
  );
};
