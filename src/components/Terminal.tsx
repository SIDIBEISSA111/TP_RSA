"use client";

import { useEffect, useRef } from "react";

function colorFor(line: string) {
  if (line.startsWith("[+]")) return "text-neon";
  if (line.startsWith("[*]")) return "text-cyan";
  if (line.startsWith("[!]")) return "text-danger";
  if (line.startsWith("[i]")) return "text-amber";
  if (line.startsWith(">")) return "text-ink";
  return "text-mute";
}

/** Journal défilant des étapes de calcul. */
export function Terminal({ lines, busy, className = "" }: { lines: string[]; busy?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);
  return (
    <div
      ref={ref}
      className={`scroll-thin max-h-72 min-h-24 overflow-auto rounded border border-line bg-void p-3 text-[11.5px] leading-relaxed ${className}`}
      aria-live="polite"
    >
      {lines.length === 0 && !busy && <div className="text-mute/60">$ en attente…</div>}
      {lines.map((l, i) => (
        <div key={i} className={`break-all whitespace-pre-wrap ${colorFor(l)}`}>
          {l}
        </div>
      ))}
      {busy && <div className="cursor text-neon" />}
    </div>
  );
}
