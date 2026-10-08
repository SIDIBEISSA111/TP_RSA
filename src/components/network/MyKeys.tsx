"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui";
import type { Account } from "@/lib/client/account";
import { bitsOf } from "./shared";

const dec = (hex: string) => BigInt("0x" + hex).toString();

export function MyKeys({ account, fresh }: { account: Account; fresh: boolean }) {
  const [reveal, setReveal] = useState(false);
  const pub = account.publicKey;
  const priv = account.privateKey;

  return (
    <div className="space-y-5">
      {fresh && (
        <div className="rise rounded-lg border border-neon/50 bg-neon/[0.06] p-4 text-sm leading-relaxed">
          <div className="mb-1 font-semibold text-neon">✓ Ta paire de clés est prête</div>
          Elle vient d&apos;être générée dans ton navigateur. Ta <b>clé publique</b> a été publiée sur le réseau : tout le monde la voit
          dans l&apos;annuaire et peut s&apos;en servir pour t&apos;écrire. Ta <b>clé privée</b> reste chez toi ; le serveur n&apos;en garde
          qu&apos;une version chiffrée par ton mot de passe.
        </div>
      )}

      <ol className="grid gap-2 text-[11px] sm:grid-cols-4">
        {[
          ["1", "Génération", "deux premiers p, q de 1024 bits tirés au hasard"],
          ["2", "Calcul", "n = p × q, e = 65537, d = e⁻¹ mod φ(n)"],
          ["3", "Publication", "(n, e) envoyée à l'annuaire, visible par tous"],
          ["4", "Protection", "d chiffrée avec ton mot de passe (AES-256)"],
        ].map(([n, t, d]) => (
          <li key={n} className="rounded border border-line bg-panel p-2.5">
            <div className="font-semibold text-neon">
              {n}. {t}
            </div>
            <div className="mt-0.5 text-mute">{d}</div>
          </li>
        ))}
      </ol>

      <section className="space-y-2 rounded-lg border border-cyan/40 bg-cyan/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-cyan">🔓 Clé publique — visible par tous</h3>
          <CopyButton text={account.fingerprint} label="Copier l'empreinte" />
        </div>
        <Field label={`n (${bitsOf(pub)} bits, ${dec(pub.n).length} chiffres)`} value={dec(pub.n)} />
        <Field label="e" value={dec(pub.e)} />
        <Field label="empreinte SHA-256" value={account.fingerprint} />
      </section>

      <section className="space-y-2 rounded-lg border border-danger/40 bg-danger/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-danger">🔐 Clé privée — ne la montre à personne</h3>
          <button
            onClick={() => setReveal(!reveal)}
            className="rounded border border-danger/50 px-2.5 py-1 text-[11px] text-danger hover:bg-danger hover:text-void"
          >
            {reveal ? "Masquer" : "Afficher"}
          </button>
        </div>
        <div className={reveal ? "" : "pointer-events-none blur-sm select-none"} aria-hidden={!reveal}>
          <Field label="d (exposant privé)" value={dec(priv.d)} />
          <Field label="p (premier secret)" value={dec(priv.p)} />
          <Field label="q (premier secret)" value={dec(priv.q)} />
        </div>
        <p className="text-[11px] text-mute">
          Déchiffrée dans cet onglet grâce à ton mot de passe. Sans elle, personne (pas même le serveur) ne peut lire les messages qui
          te sont adressés.
        </p>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] tracking-widest text-mute uppercase">{label}</div>
      <div className="scroll-thin max-h-20 overflow-y-auto rounded border border-line bg-void p-2 text-[10.5px] break-all text-ink/90">
        {value}
      </div>
    </div>
  );
}
