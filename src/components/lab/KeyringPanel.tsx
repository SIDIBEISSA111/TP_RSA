"use client";

import { useState } from "react";
import { Alert, Button, CopyButton, downloadText, inputClass } from "@/components/ui";
import { unarmor, type KeyPayload } from "@/lib/armor";
import { privateArmor, publicArmor, saveKey, slug } from "@/lib/keys";
import { keyring, useKeyring, type KeyEntry } from "@/lib/keyring";

export function KeyringPanel() {
  const keys = useKeyring();
  const [importing, setImporting] = useState(false);

  return (
    <div className="space-y-3">
      {keys.length === 0 && (
        <p className="text-xs leading-relaxed text-mute">
          Trousseau vide. Génère une paire de clés, ou importe la clé publique d&apos;un contact.
        </p>
      )}
      <ul className="space-y-2">
        {keys.map((k) => (
          <KeyItem key={k.id} entry={k} />
        ))}
      </ul>
      {importing ? <ImportBox onDone={() => setImporting(false)} /> : (
        <Button className="w-full" onClick={() => setImporting(true)}>
          + Importer une clé
        </Button>
      )}
      <p className="text-[10.5px] leading-relaxed text-mute/80">
        Les clés sont stockées dans ce navigateur uniquement. Vider les données du site les efface : exporte ta clé
        privée si tu veux la garder.
      </p>
    </div>
  );
}

function KeyItem({ entry: k }: { entry: KeyEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded border border-line bg-void/60">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
            k.kind === "pair" ? "bg-neon/15 text-neon" : "bg-cyan/15 text-cyan"
          }`}
        >
          {k.kind === "pair" ? "MOI" : "CONTACT"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{k.label}</span>
        <span className="shrink-0 text-[10px] text-mute">{k.bits}b</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-line px-3 py-2.5">
          <div className="text-[10px] break-all text-mute">
            <span className="text-neon-dim">empreinte</span> {k.fingerprint}
          </div>
          <div className="text-[10px] break-all text-mute">
            <span className="text-neon-dim">n</span> {abbrev(BigInt("0x" + k.pub.n).toString())}
          </div>
          <div className="text-[10px] text-mute">
            <span className="text-neon-dim">e</span> {BigInt("0x" + k.pub.e).toString()}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <CopyButton text={publicArmor(k)} label="Copier clé publique" />
            <Button onClick={() => downloadText(`${slug(k.label)}.pub.txt`, publicArmor(k))}>⤓ .pub</Button>
            {k.priv && (
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm("La clé privée permet de lire tous tes messages. Ne la donne à personne. Exporter quand même ?"))
                    downloadText(`${slug(k.label)}.PRIVEE.txt`, privateArmor(k));
                }}
              >
                ⤓ Privée
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => {
                const warn = k.priv
                  ? "Supprimer cette paire ? Les messages chiffrés pour elle deviendront illisibles à jamais."
                  : "Supprimer ce contact ?";
                if (confirm(warn)) keyring.remove(k.id);
              }}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function abbrev(s: string) {
  return s.length > 44 ? `${s.slice(0, 20)}…${s.slice(-20)} (${s.length} chiffres)` : s;
}

function ImportBox({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    setError("");
    try {
      const u = unarmor(text);
      if (u.kind === "MESSAGE") throw new Error("Ceci est un message chiffré : colle-le dans l'onglet Déchiffrer");
      const p = u.payload as KeyPayload;
      await saveKey(p.alg, p.label, p.pub, u.kind === "PRIVATE KEY" ? p.priv : undefined);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        className={`${inputClass} h-24 text-[10.5px]`}
        placeholder="Colle une clé publique (contact) ou ta clé privée exportée"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="primary" onClick={run} disabled={!text}>
          Importer
        </Button>
        <Button onClick={onDone}>Annuler</Button>
      </div>
    </div>
  );
}
