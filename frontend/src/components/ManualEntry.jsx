import { useState } from "react";
import { RE_TN, RE_AN, isValidSscc } from "@/lib/notes";

const digits = (v) => v.replace(/\D/g, "");

export const ManualEntry = ({ onSubmit, onClose }) => {
  const [tn, setTn] = useState("");
  const [sscc, setSscc] = useState("");
  const [an, setAn] = useState("");
  const [tried, setTried] = useState(false);

  const tnOk = RE_TN.test(tn), ssccOk = isValidSscc(sscc), anOk = !an || RE_AN.test(an);
  const ssccHint = sscc.length === 20 && !ssccOk ? "Prüfziffer stimmt nicht" : `${sscc.length}/20`;

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (tnOk && ssccOk && anOk) onSubmit(tn, sscc, an || undefined);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} data-testid="manual-entry">
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">Manuell eingeben</h2>
        <label className="field">
          <span>TN (10 Ziffern)</span>
          <input inputMode="numeric" value={tn} maxLength={10} placeholder="1234567890" autoFocus data-testid="manual-tn"
            className={tried && !tnOk ? "invalid" : ""} onChange={(e) => setTn(digits(e.target.value))} />
        </label>
        <label className="field">
          <span>SSCC (00 + 18 Ziffern) <small data-testid="manual-sscc-hint">{ssccHint}</small></span>
          <input inputMode="numeric" value={sscc} maxLength={20} placeholder="00…" data-testid="manual-sscc"
            className={tried && !ssccOk ? "invalid" : ""} onChange={(e) => setSscc(digits(e.target.value))} />
        </label>
        <label className="field">
          <span>AN (optional, z. B. D1234567)</span>
          <input value={an} maxLength={8} placeholder="D1234567" autoCapitalize="characters" data-testid="manual-an"
            className={tried && !anOk ? "invalid" : ""} onChange={(e) => setAn(e.target.value.toUpperCase().replace(/[^D0-9]/g, ""))} />
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose} data-testid="manual-cancel">Abbrechen</button>
          <button type="submit" className="btn primary" data-testid="manual-save">Hinzufügen</button>
        </div>
      </form>
    </div>
  );
};
