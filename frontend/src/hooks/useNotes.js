import { useEffect, useState } from "react";
import { ssccList, uid } from "@/lib/notes";

const KEY = "notizliste.v1";

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

const pick = (obj, keep) => (obj ? Object.fromEntries(Object.entries(obj).filter(([k]) => keep.includes(k))) : obj);

export const useNotes = () => {
  const [notes, setNotes] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notes));
  }, [notes]);

  const update = (id, fn) => setNotes((prev) => prev.map((n) => (n.id === id ? fn(n) : n)));

  const add = (note) =>
    setNotes((prev) => [{ id: uid(), completed: false, rawCodes: [], type: "manual", createdAt: Date.now(), ...note }, ...prev]);

  const toggle = (id) =>
    update(id, (n) => ({
      ...n,
      completed: !n.completed,
      ...(n.type === "label" ? { ssccDone: n.completed ? {} : Object.fromEntries(ssccList(n).map((c) => [c, true])) } : {}),
    }));

  const remove = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const clearCompleted = () =>
    setNotes((prev) =>
      prev
        .filter((n) => !n.completed)
        .map((n) => {
          if (n.type !== "label" || !n.ssccDone) return n;
          const keep = ssccList(n).filter((c) => !n.ssccDone[c]);
          if (keep.length === n.rawCodes.length - 1) return n;
          return { ...n, rawCodes: [n.rawCodes[0], ...keep], ssccNotes: pick(n.ssccNotes, keep), ssccOpts: pick(n.ssccOpts, keep), ssccDone: {} };
        })
    );

  const hasCodes = ([tn, sscc]) => notes.some((n) => n.type === "label" && n.rawCodes?.[0] === tn && ssccList(n).includes(sscc));

  const findByTn = (tn) => notes.find((n) => n.type === "label" && n.rawCodes?.[0] === tn);

  const addSscc = (tn, sscc, an) =>
    setNotes((prev) =>
      prev.map((n) =>
        n.type === "label" && n.rawCodes?.[0] === tn && !n.rawCodes.includes(sscc)
          ? { ...n, rawCodes: [...n.rawCodes, sscc], completed: false, ...(an && !n.an ? { an } : {}) }
          : n
      )
    );

  const setSsccNote = (id, code, text) =>
    update(id, (n) => {
      const ssccNotes = { ...(n.ssccNotes || {}) };
      if (text) ssccNotes[code] = text; else delete ssccNotes[code];
      return { ...n, ssccNotes };
    });

  const setSsccOpts = (id, code, opts) =>
    update(id, (n) => {
      const ssccOpts = { ...(n.ssccOpts || {}) };
      if (opts?.length) ssccOpts[code] = opts; else delete ssccOpts[code];
      return { ...n, ssccOpts };
    });

  const toggleSscc = (id, code) =>
    update(id, (n) => {
      const ssccDone = { ...(n.ssccDone || {}) };
      if (ssccDone[code]) delete ssccDone[code]; else ssccDone[code] = true;
      return { ...n, ssccDone, completed: ssccList(n).every((c) => ssccDone[c]) };
    });

  const replaceAll = (list) => setNotes(list);

  return { notes, add, toggle, remove, clearCompleted, hasCodes, findByTn, addSscc, setSsccNote, setSsccOpts, toggleSscc, replaceAll };
};
