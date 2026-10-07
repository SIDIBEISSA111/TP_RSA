"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

/** Fenêtre façon terminal, avec barre de titre. */
export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rise overflow-hidden rounded-lg border border-line bg-panel/90 box-glow ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-line bg-panel-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-danger/70" />
            <span className="size-2.5 rounded-full bg-amber/70" />
            <span className="size-2.5 rounded-full bg-neon/70" />
          </span>
          <h2 className="truncate text-xs tracking-wider text-mute">{title}</h2>
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

type Variant = "primary" | "ghost" | "danger";

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary:
      "border-neon bg-neon/15 text-neon hover:bg-neon hover:text-void shadow-[0_0_20px_-6px_var(--color-neon)]",
    ghost: "border-line-strong text-ink hover:border-neon hover:text-neon",
    danger: "border-danger/50 text-danger hover:bg-danger hover:text-void",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-xs font-semibold tracking-wider uppercase transition-all disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    />
  );
}

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // presse-papiers refusé : l'utilisateur peut toujours sélectionner le texte
        }
      }}
    >
      {done ? "✓ Copié" : label}
    </Button>
  );
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[11px] tracking-widest text-mute uppercase">{children}</label>;
}

export const inputClass =
  "w-full rounded border border-line bg-void/80 px-3 py-2 text-sm text-ink placeholder:text-mute/60 outline-none transition focus:border-neon focus:shadow-[0_0_0_3px_rgba(0,255,156,0.12)]";

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "warn"; children: ReactNode }) {
  const styles = {
    error: "border-danger/50 bg-danger/10 text-danger",
    info: "border-cyan/40 bg-cyan/5 text-cyan",
    warn: "border-amber/40 bg-amber/5 text-amber",
  };
  const icon = { error: "[!]", info: "[i]", warn: "[~]" };
  return (
    <div className={`rounded border px-3 py-2 text-xs leading-relaxed ${styles[kind]}`}>
      <span className="mr-2 font-bold">{icon[kind]}</span>
      {children}
    </div>
  );
}
