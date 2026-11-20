export const ConfirmDialog = ({ title, text, confirmLabel, onConfirm, onClose }) => (
  <div className="sheet-backdrop" onClick={onClose} data-testid="confirm-dialog">
    <div className="dialog" onClick={(e) => e.stopPropagation()} role="alertdialog">
      <h3 data-testid="confirm-title">{title}</h3>
      <p>{text}</p>
      <div className="dialog-actions">
        <button type="button" className="btn ghost" onClick={onClose} data-testid="confirm-cancel">Abbrechen</button>
        <button type="button" className="btn danger" onClick={() => { onConfirm(); onClose(); }} data-testid="confirm-ok">{confirmLabel}</button>
      </div>
    </div>
  </div>
);
