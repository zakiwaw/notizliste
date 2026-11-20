import { ssccList, isSsccDone } from "@/lib/notes";

const stamp = () => new Date().toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
const box = (done) => (done ? "☑" : "☐");

export const toText = (notes) => {
  const open = notes.filter((n) => !n.completed).length;
  const lines = [`Notizliste – ${stamp()}`, `Offen: ${open} · Erledigt: ${notes.length - open}`, ""];
  for (const n of notes) {
    if (n.type === "label") {
      lines.push(`${box(n.completed)} TN ${n.rawCodes[0]}${n.an ? ` · AN ${n.an}` : ""}`);
      for (const c of ssccList(n)) {
        const extra = [...((n.ssccOpts || {})[c] || []), (n.ssccNotes || {})[c]].filter(Boolean).join(" · ");
        lines.push(`   ${box(isSsccDone(n, c))} SSCC ${c}${extra ? ` – ${extra}` : ""}`);
      }
    } else {
      lines.push(`${box(n.completed)} ${n.text}`);
    }
  }
  return lines.join("\n");
};

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export const toCsv = (notes) => {
  const rows = [["Typ", "TN", "AN", "SSCC", "Status", "Optionen", "Notiz"]];
  for (const n of notes) {
    if (n.type === "label") {
      const list = ssccList(n);
      if (!list.length) rows.push(["Etikett", n.rawCodes[0], n.an || "", "", n.completed ? "erledigt" : "offen", "", ""]);
      for (const c of list) {
        rows.push(["Etikett", n.rawCodes[0], n.an || "", c, isSsccDone(n, c) ? "erledigt" : "offen", ((n.ssccOpts || {})[c] || []).join(", "), (n.ssccNotes || {})[c] || ""]);
      }
    } else {
      rows.push(["Notiz", "", "", "", n.completed ? "erledigt" : "offen", "", n.text]);
    }
  }
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
};

const fileName = (ext) => `notizliste-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`;

export const shareText = async (text) => {
  if (navigator.share) {
    try { await navigator.share({ title: "Notizliste", text }); return "shared"; } catch (e) { if (e.name === "AbortError") return "aborted"; }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
};

export const copyText = async (text) => {
  await navigator.clipboard.writeText(text);
  return "copied";
};

export const shareCsv = async (csv) => {
  const file = new File([csv], fileName("csv"), { type: "text/csv;charset=utf-8" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Notizliste" }); return "shared"; } catch (e) { if (e.name === "AbortError") return "aborted"; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
};
