"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/lab", label: "Labo" },
  { href: "/titan", label: "Titan" },
  { href: "/learn", label: "Apprendre" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-xs font-bold tracking-widest sm:text-sm">
          <span className="grid size-7 place-items-center rounded border border-neon/50 text-neon glow">⌬</span>
          <span>
            CIPHER<span className="text-neon glow">{"//"}</span>LAB
          </span>
        </Link>
        <div className="flex items-center gap-1 text-xs sm:text-sm">
          {LINKS.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-2 py-1.5 transition-colors sm:px-3 ${
                  active ? "bg-neon/10 text-neon glow" : "text-mute hover:text-ink"
                }`}
              >
                <span className="hidden text-neon-dim sm:inline">./</span>
                {l.label.toLowerCase()}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
