"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";
import { SCHEMES } from "@/lib/crypto/registry";
import { DecryptTab } from "./DecryptTab";
import { EncryptTab } from "./EncryptTab";
import { KeyringPanel } from "./KeyringPanel";
import { KeysTab } from "./KeysTab";

const TABS = [
  { id: "keys", n: "01", label: "Clés" },
  { id: "encrypt", n: "02", label: "Chiffrer" },
  { id: "decrypt", n: "03", label: "Déchiffrer" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LabClient() {
  const [tab, setTab] = useState<TabId>("keys");
  const [scheme, setScheme] = useState("RSA");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-cyan glow-cyan">{"// LABO"}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">
            Atelier <span className="text-neon glow">{scheme}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Méthode de chiffrement">
          {SCHEMES.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={scheme === s.id}
              disabled={!s.ready}
              onClick={() => setScheme(s.id)}
              title={s.ready ? s.tagline : "Bientôt disponible"}
              className={`rounded border px-3 py-1.5 text-xs transition ${
                scheme === s.id
                  ? "border-neon bg-neon/15 text-neon"
                  : s.ready
                    ? "border-line text-ink hover:border-neon"
                    : "cursor-not-allowed border-dashed border-line text-mute/50"
              }`}
            >
              {s.name}
              {!s.ready && <span className="ml-1 text-[9px]">bientôt</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-t border-b-2 px-2 py-2.5 text-left text-xs transition sm:text-sm ${
                  tab === t.id ? "border-neon bg-neon/10 text-neon" : "border-line text-mute hover:text-ink"
                }`}
              >
                <span className="mr-1.5 text-[10px] opacity-60">{t.n}</span>
                {t.label}
              </button>
            ))}
          </div>
          <Panel title={`${scheme.toLowerCase()}/${tab}.sh`}>
            {/* Les onglets restent montés : on garde la saisie et les calculs en cours en changeant d'onglet */}
            <div hidden={tab !== "keys"}>
              <KeysTab />
            </div>
            <div hidden={tab !== "encrypt"}>
              <EncryptTab />
            </div>
            <div hidden={tab !== "decrypt"}>
              <DecryptTab />
            </div>
          </Panel>
        </div>
        <Panel title="trousseau.db" className="h-fit lg:sticky lg:top-20">
          <KeyringPanel />
        </Panel>
      </div>
    </div>
  );
}
