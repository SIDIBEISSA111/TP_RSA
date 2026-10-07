"use client";

import { useState } from "react";
import { Alert, Button, CopyButton, Label, downloadText, inputClass } from "@/components/ui";
import { Terminal } from "@/components/Terminal";
import { armor, unarmor, type KeyPayload } from "@/lib/armor";
import { fingerprint, getScheme, type Envelope, type KeyRecord } from "@/lib/crypto/registry";
import { saveKey, slug } from "@/lib/keys";
import { useKeyring } from "@/lib/keyring";
import { timed } from "@/lib/timing";

export function EncryptTab() {
  const keys = useKeyring();
  const [recipientId, setRecipientId] = useState<string>("");
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [savedContact, setSavedContact] = useState(false);

  const selected = keys.find((k) => k.id === recipientId) ?? (recipientId === "" ? keys[0] : undefined);
  const usePasted = recipientId === "__paste";

  const resolveRecipient = (): { alg: string; label: string; pub: KeyRecord } => {
    if (usePasted) {
      const u = unarmor(pasted);
      if (u.kind === "MESSAGE") throw new Error("Ceci est un message chiffré, pas une clé publique");
      const payload = u.payload as KeyPayload;
      return { alg: payload.alg, label: payload.label, pub: payload.pub };
    }
    if (!selected) throw new Error("Choisis un destinataire, ou colle sa clé publique");
    return selected;
  };

  const run = async () => {
    setError("");
    setOutput("");
    setSavedContact(false);
    try {
      if (!message) throw new Error("Écris d'abord un message");
      const r = resolveRecipient();
      const scheme = getScheme(r.alg);
      const [enc, ms] = timed(() => scheme.encrypt(message, r.pub));
      const kid = await fingerprint(r.alg, r.pub);
      const env: Envelope = { v: 1, alg: r.alg, kid, mode: enc.mode, blocks: enc.blocks };
      setOutput(armor("MESSAGE", r.alg, env));
      setLines([
        `> encrypt --to "${r.label}" --alg ${r.alg}`,
        `[*] Clé du destinataire : ${scheme.bits(r.pub)} bits, empreinte ${kid}`,
        ...enc.trace,
        `[+] ${enc.blocks.length} bloc(s) chiffré(s) en ${ms.toFixed(1)} ms`,
      ]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveContact = async () => {
    const u = unarmor(pasted);
    const payload = u.payload as KeyPayload;
    await saveKey(payload.alg, payload.label, payload.pub);
    setSavedContact(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Destinataire</Label>
        <select
          className={inputClass}
          value={recipientId || selected?.id || "__paste"}
          onChange={(e) => setRecipientId(e.target.value)}
        >
          {keys.map((k) => (
            <option key={k.id} value={k.id}>
              {k.kind === "pair" ? "🔑 moi" : "👤 contact"} — {k.label} ({k.bits} bits)
            </option>
          ))}
          <option value="__paste">📋 Coller une clé publique…</option>
        </select>
      </div>

      {(usePasted || keys.length === 0) && (
        <div className="space-y-2">
          <textarea
            className={`${inputClass} h-28 resize-y text-[11px]`}
            placeholder="-----BEGIN CIPHERLAB RSA PUBLIC KEY-----"
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setRecipientId("__paste");
            }}
          />
          {pasted && !savedContact && (
            <Button onClick={() => saveContact().catch((e) => setError(e.message))}>
              + Ajouter ce contact au trousseau
            </Button>
          )}
          {savedContact && <p className="text-xs text-neon">✓ Contact enregistré</p>}
        </div>
      )}

      <div>
        <Label>Message en clair</Label>
        <textarea
          className={`${inputClass} h-32 resize-y`}
          placeholder="Rendez-vous à 18h devant la bibliothèque…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={20000}
        />
      </div>

      <Button variant="primary" onClick={run}>
        🔒 Chiffrer
      </Button>
      {error && <Alert>{error}</Alert>}
      {lines.length > 0 && <Terminal lines={lines} />}

      {output && (
        <div className="rise space-y-2">
          <Label>Message chiffré — à envoyer au destinataire</Label>
          <textarea readOnly className={`${inputClass} h-40 text-[11px] text-cyan`} value={output} />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={output} />
            <Button onClick={() => downloadText(`message-${slug(selected?.label ?? "chiffre")}.cipher.txt`, output)}>
              ⤓ Télécharger
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
