"use client";

import { useState } from "react";
import { Alert, Button, Label, inputClass } from "@/components/ui";
import { Terminal } from "@/components/Terminal";
import { unarmor } from "@/lib/armor";
import { getScheme, type Envelope } from "@/lib/crypto/registry";
import { useKeyring } from "@/lib/keyring";
import { timed } from "@/lib/timing";

export function DecryptTab() {
  const keys = useKeyring();
  const privateKeys = keys.filter((k) => k.priv);
  const [input, setInput] = useState("");
  const [forcedKey, setForcedKey] = useState("");
  const [plain, setPlain] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState("");

  const run = () => {
    setError("");
    setPlain(null);
    try {
      const u = unarmor(input);
      if (u.kind !== "MESSAGE") throw new Error("Ceci est une clé, pas un message chiffré");
      const env = u.payload as Envelope;
      const key = forcedKey ? privateKeys.find((k) => k.id === forcedKey) : privateKeys.find((k) => k.fingerprint === env.kid);
      if (!key?.priv) {
        throw new Error(
          `Aucune de tes clés privées ne correspond à ce message (empreinte ${env.kid}). Il a été chiffré pour quelqu'un d'autre, ou la clé a été supprimée de ce navigateur.`,
        );
      }
      const priv = key.priv;
      const [r, ms] = timed(() => getScheme(env.alg).decrypt(env, priv));
      setLines([
        `> decrypt --key "${key.label}" --alg ${env.alg}`,
        `[*] Clé privée trouvée : ${key.fingerprint}`,
        ...r.trace,
        `[+] Déchiffré en ${ms.toFixed(1)} ms`,
      ]);
      setPlain(r.text);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadFile = async (file?: File) => {
    if (file) setInput(await file.text());
  };

  return (
    <div className="space-y-4">
      {privateKeys.length === 0 && (
        <Alert kind="warn">Tu n&apos;as encore aucune clé privée : génère d&apos;abord une paire dans l&apos;onglet Clés.</Alert>
      )}
      <div>
        <Label>Message chiffré reçu</Label>
        <textarea
          className={`${inputClass} h-40 resize-y text-[11px]`}
          placeholder="-----BEGIN CIPHERLAB RSA MESSAGE-----"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <label className="mt-2 inline-block cursor-pointer text-xs text-mute hover:text-neon">
          ⤒ ou ouvrir un fichier .cipher.txt
          <input type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
        </label>
      </div>
      {privateKeys.length > 1 && (
        <div>
          <Label>Clé privée</Label>
          <select className={inputClass} value={forcedKey} onChange={(e) => setForcedKey(e.target.value)}>
            <option value="">Détection automatique (par empreinte)</option>
            {privateKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} — {k.fingerprint.slice(0, 14)}…
              </option>
            ))}
          </select>
        </div>
      )}
      <Button variant="primary" onClick={run} disabled={!input}>
        🔓 Déchiffrer
      </Button>
      {error && <Alert>{error}</Alert>}
      {lines.length > 0 && <Terminal lines={lines} />}
      {plain !== null && (
        <div className="rise rounded-lg border border-neon/50 bg-neon/5 p-4 box-glow">
          <div className="mb-2 text-[11px] tracking-widest text-neon uppercase">✓ Message déchiffré</div>
          <p className="text-base break-words whitespace-pre-wrap text-ink glow">{plain}</p>
        </div>
      )}
    </div>
  );
}
