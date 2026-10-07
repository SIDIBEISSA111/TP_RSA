"use client";

import { useEffect, useState } from "react";

const LINES = [
  "> init cipher-core v1.0 …………………… OK",
  "> load bigint engine (BigInt natif) …… OK",
  "> csprng: crypto.getRandomValues …… OK",
  "> modules: [RSA] elgamal… ecc… paillier…",
  "> private keys never leave this device.",
  "> ready_",
];

export function BootSequence() {
  const [shown, setShown] = useState<string[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let line = 0;
    let char = 0;
    const id = setInterval(() => {
      if (line >= LINES.length) return clearInterval(id);
      char += reduce ? 1000 : 3;
      const idx = line;
      const current = LINES[idx].slice(0, char);
      setShown((prev) => [...prev.slice(0, idx), current]);
      if (char >= LINES[line].length) {
        line++;
        char = 0;
      }
    }, 18);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-[9.5rem] text-left text-[11px] leading-relaxed text-neon-dim sm:text-xs">
      {shown.map((l, i) => (
        <div key={i} className={l.includes("OK") ? "" : l.includes("ready") ? "text-neon glow" : "text-mute"}>
          {l.replace(/OK$/, "")}
          {l.endsWith("OK") && <span className="text-neon">OK</span>}
        </div>
      ))}
    </div>
  );
}
