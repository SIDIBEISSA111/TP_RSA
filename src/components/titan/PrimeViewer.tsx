"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Label, inputClass } from "@/components/ui";

export type Which = "p" | "q" | "n";

interface ManifestEntry {
  digits: number;
  sha256: string;
  head: string;
  tail: string;
}

export interface Verified {
  which: Which;
  digits: number;
  sha256: string;
  ms: number;
}

const INFO: Record<Which, { title: string; formula: string; note: string }> = {
  p: { title: "Premier p", formula: "2^6 972 593 − 1", note: "38ᵉ nombre premier de Mersenne, découvert en 1999 par le projet GIMPS" },
  q: { title: "Premier q", formula: "2^13 466 917 − 1", note: "39ᵉ nombre premier de Mersenne, découvert en 2001 par le projet GIMPS" },
  n: { title: "Module n = p × q", formula: "(2^6 972 593 − 1) × (2^13 466 917 − 1)", note: "La clé publique RSA du mode Titan" },
};

const PAGE = 10_000;
const ROW = 100;
const fr = (n: number) => n.toLocaleString("fr-FR");

export function PrimeViewer({
  verified,
  verifying,
  onVerify,
}: {
  verified: Partial<Record<Which, Verified>>;
  verifying: Which | null;
  onVerify: (w: Which) => void;
}) {
  const [which, setWhich] = useState<Which>("p");
  const [manifest, setManifest] = useState<Record<Which, ManifestEntry> | null>(null);
  const [texts, setTexts] = useState<Partial<Record<Which, string>>>({});
  const [page, setPage] = useState(0);
  const [jump, setJump] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/primes/manifest.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setError("Impossible de charger la liste des nombres"));
  }, []);

  useEffect(() => {
    if (texts[which]) return;
    let alive = true;
    fetch(`/primes/${which}.txt`)
      .then((r) => r.text())
      .then((t) => alive && setTexts((prev) => ({ ...prev, [which]: t })))
      .catch(() => alive && setError("Téléchargement interrompu"));
    return () => {
      alive = false;
    };
  }, [which, texts]);

  const text = texts[which];
  const meta = manifest?.[which];
  const pages = meta ? Math.ceil(meta.digits / PAGE) : 1;
  const rows = useMemo(() => {
    if (!text) return [];
    const chunk = text.slice(page * PAGE, (page + 1) * PAGE);
    const out: { start: number; groups: string[] }[] = [];
    for (let i = 0; i < chunk.length; i += ROW) {
      const line = chunk.slice(i, i + ROW);
      out.push({ start: page * PAGE + i + 1, groups: line.match(/.{1,10}/g) ?? [] });
    }
    return out;
  }, [text, page]);

  const select = (w: Which) => {
    setWhich(w);
    setPage(0);
    setJump("");
  };

  const goTo = () => {
    const pos = Number(jump.replace(/\s/g, ""));
    if (meta && pos >= 1 && pos <= meta.digits) setPage(Math.floor((pos - 1) / PAGE));
  };

  const v = verified[which];
  const match = v && meta ? v.sha256 === meta.sha256 && v.digits === meta.digits : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(["p", "q", "n"] as const).map((w) => (
          <button
            key={w}
            onClick={() => select(w)}
            className={`rounded border px-3 py-3 text-left transition ${
              which === w ? "border-amber bg-amber/10" : "border-line hover:border-line-strong"
            }`}
          >
            <div className={`font-display text-2xl font-bold ${which === w ? "text-amber" : "text-ink"}`}>{w}</div>
            <div className="text-[11px] text-mute">{manifest ? `${fr(manifest[w].digits)} chiffres` : "…"}</div>
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-amber/30 bg-panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-amber">{INFO[which].title}</h3>
          <span className="text-xs text-ink">{INFO[which].formula}</span>
        </div>
        <p className="text-xs text-mute">{INFO[which].note}</p>
        {meta && (
          <div className="grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-2">
            <div className="bg-void px-3 py-2.5">
              <div className="font-display text-2xl font-bold text-neon">{fr(meta.digits)}</div>
              <div className="text-[11px] text-mute">chiffres décimaux {which !== "n" && meta.digits > 1_000_000 && "· ✓ plus d'un million"}</div>
            </div>
            <div className="bg-void px-3 py-2.5">
              <div className="text-[10.5px] break-all text-cyan">{meta.sha256}</div>
              <div className="text-[11px] text-mute">empreinte SHA-256 du fichier</div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/primes/${which}.txt`}
            download={`titan-${which}.txt`}
            className="inline-flex items-center rounded border border-line-strong px-3 py-2 text-xs font-semibold tracking-wider text-ink uppercase hover:border-neon hover:text-neon"
          >
            ⤓ Télécharger {which} ({meta ? (meta.digits / 1e6).toFixed(1).replace(".", ",") : "…"} Mo)
          </a>
          <Button variant="primary" disabled={verifying !== null} onClick={() => onVerify(which)}>
            {verifying === which ? "Recalcul en cours…" : "⟳ Recalculer dans mon navigateur et comparer"}
          </Button>
        </div>
        {verifying === which && (
          <p className="cursor text-[11px] text-mute">
            calcul de {INFO[which].formula} puis conversion en base 10 ({which === "p" ? "≈ 5" : which === "q" ? "≈ 10" : "≈ 20"} s)
          </p>
        )}
        {v && match !== null && (
          <Alert kind={match ? "info" : "error"}>
            {match
              ? `Vérifié en ${(v.ms / 1000).toFixed(1)} s : ton navigateur a recalculé ${INFO[which].formula} et obtient exactement les mêmes ${fr(v.digits)} chiffres (même SHA-256) que le fichier affiché.`
              : "Différence entre le calcul et le fichier : le fichier a été modifié."}
          </Alert>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1">
          <Button onClick={() => setPage(0)} disabled={page === 0}>«</Button>
          <Button onClick={() => setPage(page - 1)} disabled={page === 0}>‹</Button>
          <span className="px-2 text-xs text-mute">
            page <span className="text-ink">{fr(page + 1)}</span> / {fr(pages)}
          </span>
          <Button onClick={() => setPage(page + 1)} disabled={page >= pages - 1}>›</Button>
          <Button onClick={() => setPage(pages - 1)} disabled={page >= pages - 1}>»</Button>
        </div>
        <div className="flex items-end gap-1.5">
          <div>
            <Label>Aller au chiffre n°</Label>
            <input
              className={`${inputClass} w-36 py-1.5`}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goTo()}
              inputMode="numeric"
              placeholder="1 000 000"
            />
          </div>
          <Button onClick={goTo}>OK</Button>
        </div>
      </div>

      <div className="scroll-thin overflow-x-auto rounded border border-line bg-void p-3">
        {!text ? (
          <div className="cursor py-10 text-center text-xs text-mute">chargement de {meta ? fr(meta.digits) : "…"} chiffres</div>
        ) : (
          <table className="text-[11.5px] leading-relaxed">
            <tbody>
              {rows.map((r) => (
                <tr key={r.start}>
                  <td className="pr-4 text-right align-top whitespace-nowrap text-mute/60 select-none">{fr(r.start)}</td>
                  <td className="whitespace-nowrap text-neon">
                    {r.groups.map((g, i) => (
                      <span key={i} className={i % 2 ? "text-neon-dim" : ""}>
                        {g}{" "}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-mute">
        Chaque ligne contient 100 chiffres, groupés par 10. Le numéro à gauche est la position du premier chiffre de la ligne.
      </p>
    </div>
  );
}

const LL_CHOICES = [
  { k: 11, note: "2047 = 23 × 89 : pas premier" },
  { k: 127, note: "prouvé premier en 1876 (Lucas, à la main)" },
  { k: 521, note: "1952, premier calcul sur ordinateur" },
  { k: 1279, note: "1952" },
  { k: 2203, note: "1952" },
  { k: 4423, note: "1961" },
  { k: 9941, note: "1963" },
];

export function LucasLehmer({ result, running, onRun }: {
  result: { k: number; prime: boolean; ms: number } | null;
  running: boolean;
  onRun: (k: number) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-mute">
        Comment sait-on que p et q sont premiers ? Pour un nombre de Mersenne M = 2ᵏ − 1, il existe un test exact, le{" "}
        <b className="text-ink">test de Lucas-Lehmer</b> : on part de s = 4, on répète s ← s² − 2 mod M exactement k − 2 fois, et
        M est premier si et seulement si on tombe sur 0. Essaie-le sur des nombres de Mersenne plus petits :
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LL_CHOICES.map((c) => (
          <button
            key={c.k}
            disabled={running}
            onClick={() => onRun(c.k)}
            title={c.note}
            className="rounded border border-line px-2.5 py-1.5 text-xs transition hover:border-neon hover:text-neon disabled:opacity-40"
          >
            2^{fr(c.k)} − 1
          </button>
        ))}
      </div>
      {running && <p className="cursor text-xs text-mute">s ← s² − 2 mod M</p>}
      {result && !running && (
        <Alert kind={result.prime ? "info" : "warn"}>
          2^{fr(result.k)} − 1 ({fr(Math.floor(result.k * Math.log10(2)) + 1)} chiffres) :{" "}
          {result.prime ? "PREMIER" : "COMPOSÉ"} — {fr(result.k - 2)} itérations en {result.ms.toFixed(0)} ms.
        </Alert>
      )}
      <p className="text-[11px] leading-relaxed text-mute">
        Pour p, il faut 6 972 591 itérations sur des nombres de 7 millions de bits : des heures de calcul avec les logiciels spécialisés
        de GIMPS (Prime95), qui ont certifié p et q, ensuite revérifiés de façon indépendante.
      </p>
    </div>
  );
}
