"use client";

import { useRef, useState } from "react";
import { Alert, Button, CopyButton, Label, inputClass } from "@/components/ui";
import { Terminal } from "@/components/Terminal";
import { generatePrime } from "@/lib/crypto/math";
import { buildKeyFromPrimes, type RsaPrivateKey } from "@/lib/crypto/rsa";
import { rsaPrivateRecord, rsaPublicRecord } from "@/lib/crypto/registry";
import { publicArmor, saveKey } from "@/lib/keys";
import type { KeyEntry } from "@/lib/keyring";

const SIZES = [512, 1024, 2048, 3072, 4096];

export function KeysTab({ onCreated }: { onCreated?: (k: KeyEntry) => void }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded border border-line p-0.5 text-xs">
        {(
          [
            ["auto", "Génération automatique"],
            ["manual", "Mode labo : p, q, e à la main"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1.5 transition ${mode === m ? "bg-neon/15 text-neon" : "text-mute hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "auto" ? <AutoKeys onCreated={onCreated} /> : <ManualKeys onCreated={onCreated} />}
    </div>
  );
}

function AutoKeys({ onCreated }: { onCreated?: (k: KeyEntry) => void }) {
  const [bits, setBits] = useState(2048);
  const [label, setLabel] = useState("Ma clé");
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<KeyEntry | null>(null);
  const worker = useRef<Worker | null>(null);

  const start = () => {
    setBusy(true);
    setCreated(null);
    setLines([`> rsa-keygen --bits ${bits} --e 65537`]);
    const w = new Worker(new URL("../../workers/rsa.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === "log") setLines((l) => [...l.slice(-200), msg.line]);
      else if (msg.type === "error") {
        setLines((l) => [...l, `[!] ${msg.message}`]);
        stop();
      } else if (msg.type === "done") {
        stop();
        const pub = { n: msg.record.n, e: msg.record.e };
        const entry = await saveKey("RSA", label, pub, msg.record);
        setLines((l) => [
          ...l,
          `[+] Paire générée en ${(msg.ms / 1000).toFixed(2)} s`,
          `[+] Empreinte : ${entry.fingerprint}`,
          `[+] Enregistrée dans le trousseau sous « ${entry.label} »`,
        ]);
        setCreated(entry);
        onCreated?.(entry);
      }
    };
    w.postMessage({ bits });
  };

  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Nom de la clé</Label>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
        </div>
        <div>
          <Label>Taille du module n</Label>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setBits(s)}
                className={`rounded border px-2.5 py-1.5 text-xs transition ${
                  bits === s ? "border-neon bg-neon/15 text-neon" : "border-line text-mute hover:border-line-strong"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      {bits >= 3072 && (
        <Alert kind="info">
          {bits} bits : la recherche de nombres premiers peut prendre de quelques secondes à une minute, surtout sur
          téléphone.
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={start} disabled={busy}>
          {busy ? "Calcul en cours…" : "⚙ Générer la paire de clés"}
        </Button>
        {busy && (
          <Button variant="danger" onClick={stop}>
            Annuler
          </Button>
        )}
      </div>
      <Terminal lines={lines} busy={busy} />
      {created && <CreatedKey entry={created} />}
    </div>
  );
}

function CreatedKey({ entry }: { entry: KeyEntry }) {
  return (
    <div className="rise space-y-2 rounded border border-neon/40 bg-neon/5 p-3">
      <p className="text-xs text-neon">
        ✓ Ta clé est prête. Envoie ta <b>clé publique</b> à tes correspondants pour qu&apos;ils puissent t&apos;écrire.
      </p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={publicArmor(entry)} label="Copier ma clé publique" />
      </div>
    </div>
  );
}

function ManualKeys({ onCreated }: { onCreated?: (k: KeyEntry) => void }) {
  const [p, setP] = useState("61");
  const [q, setQ] = useState("53");
  const [e, setE] = useState("17");
  const [label, setLabel] = useState("Clé de démo");
  const [lines, setLines] = useState<string[]>([]);
  const [key, setKey] = useState<RsaPrivateKey | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<KeyEntry | null>(null);

  const compute = () => {
    setError("");
    setKey(null);
    setCreated(null);
    try {
      const parse = (v: string, name: string) => {
        if (!/^\d+$/.test(v.trim())) throw new Error(`${name} doit être un entier positif`);
        return BigInt(v.trim());
      };
      const { key, steps } = buildKeyFromPrimes(parse(p, "p"), parse(q, "q"), parse(e, "e"));
      setLines([`> rsa-keygen --p ${p} --q ${q} --e ${e}`, ...steps.map((s) => `[+] ${s}`)]);
      setKey(key);
    } catch (err) {
      setError((err as Error).message);
      setLines([]);
    }
  };

  const randomPrimes = (bits: number) => {
    setP(generatePrime(bits).toString());
    setQ(generatePrime(bits).toString());
    setE("65537");
  };

  const save = async () => {
    if (!key) return;
    const entry = await saveKey("RSA", label, rsaPublicRecord(key), rsaPrivateRecord(key));
    setCreated(entry);
    setLines((l) => [...l, `[+] Enregistrée — empreinte ${entry.fingerprint}`]);
    onCreated?.(entry);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-mute">
        Choisis toi-même les deux nombres premiers et l&apos;exposant public : chaque étape du calcul s&apos;affiche,
        comme au tableau.
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="py-1.5 text-mute">Préremplir :</span>
        <Button onClick={() => (setP("61"), setQ("53"), setE("17"))}>Exemple du cours</Button>
        <Button onClick={() => randomPrimes(16)}>Premiers 16 bits</Button>
        <Button onClick={() => randomPrimes(64)}>Premiers 64 bits</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["p (premier)", p, setP],
            ["q (premier)", q, setQ],
            ["e (exposant public)", e, setE],
          ] as const
        ).map(([l, v, set]) => (
          <div key={l}>
            <Label>{l}</Label>
            <input className={inputClass} value={v} onChange={(ev) => set(ev.target.value)} inputMode="numeric" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={compute}>
          ∑ Calculer la clé
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      <Terminal lines={lines} />
      {key && !created && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Label>Nom de la clé</Label>
            <input className={inputClass} value={label} onChange={(ev) => setLabel(ev.target.value)} maxLength={40} />
          </div>
          <Button variant="primary" onClick={save}>
            Enregistrer dans le trousseau
          </Button>
        </div>
      )}
      {created && <CreatedKey entry={created} />}
    </div>
  );
}
