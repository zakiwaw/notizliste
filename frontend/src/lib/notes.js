import { ssccGueltig } from "@/lib/capture";

export const RE_TN = /^\d{10}$/;
export const RE_AN = /^D\d{7}$/;
export const isValidSscc = ssccGueltig;

export const OPTIONS = ["XRY + EDD", "XRY + ETD", "Unsicher machen", "Nicht eingelagert", "HRCM", "EBR anfordern", "Enthaftung anfordern"];

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const ssccList = (note) => (note.rawCodes || []).slice(1);
export const isSsccDone = (note, code) => !!(note.ssccDone || {})[code];
