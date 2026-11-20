// Haptik + Ton: iOS hat kein navigator.vibrate, Fallback über einen Switch-Checkbox-Klick
export const buzz = (times) => {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(times === 2 ? [70, 70, 70] : 80);
      return;
    }
    const l = document.createElement("label");
    l.setAttribute("aria-hidden", "true");
    l.style.cssText = "position:fixed;left:-99px;top:-99px;opacity:0;pointer-events:none";
    const i = document.createElement("input");
    i.type = "checkbox";
    i.setAttribute("switch", "");
    l.appendChild(i);
    document.body.appendChild(l);
    l.click();
    if (times === 2) setTimeout(() => l.click(), 110);
    setTimeout(() => l.remove(), 500);
  } catch (_) {}
};

let audio = null;
const audioCtx = () => {
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  audio = audio || new A();
  if (audio.state === "suspended" && audio.resume) audio.resume();
  return audio;
};

export const unlockAudio = () => {
  const u = () => { try { audioCtx(); } catch (_) {} };
  document.addEventListener("pointerdown", u, { passive: true });
  document.addEventListener("touchend", u, { passive: true });
};

export const beep = () => {
  try {
    const ac = audioCtx();
    if (!ac) return;
    [0, 0.24].forEach((d) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.value = 1e-4;
      o.connect(g);
      g.connect(ac.destination);
      const t = ac.currentTime + d;
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 0.17);
      o.start(t);
      o.stop(t + 0.19);
    });
  } catch (_) {}
};
