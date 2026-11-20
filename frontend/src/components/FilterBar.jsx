import { Search, X } from "lucide-react";

const CHIPS = [["all", "Alle"], ["open", "Offen"], ["done", "Erledigt"]];

export const FilterBar = ({ query, onQuery, status, onStatus, stats }) => (
  <div className="filterbar" data-testid="filter-bar">
    <div className="search">
      <Search size={17} className="search-icon" />
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="TN, SSCC, AN oder Notiz suchen…"
        inputMode="search"
        data-testid="search-input"
      />
      {query && (
        <button type="button" className="search-clear" onClick={() => onQuery("")} aria-label="Suche löschen" data-testid="search-clear">
          <X size={14} />
        </button>
      )}
    </div>
    <div className="chips-row">
      <div className="chips" role="tablist">
        {CHIPS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={status === k} className={`chip${status === k ? " on" : ""}`} onClick={() => onStatus(k)} data-testid={`filter-${k}`}>
            {label}
          </button>
        ))}
      </div>
      <span className="stats" data-testid="stats">
        {stats.open} offen · {stats.done} erledigt · {stats.sscc} SSCC
      </span>
    </div>
  </div>
);
