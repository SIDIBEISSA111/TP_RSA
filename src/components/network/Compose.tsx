"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Label, inputClass } from "@/components/ui";
import { fingerprint, type Envelope } from "@/lib/crypto/registry";
import { api, type Account } from "@/lib/client/account";
import { Avatar, StepLog, bitsOf, playSteps, seal, shortHex, type DirEntry } from "./shared";

const MAX_CHARS = 1500;

interface Sealed {
  forRecipient: Envelope;
  forMe: Envelope;
  text: string;
  to: string;
}

export function Compose({
  account,
  dir,
  to,
  setTo,
  onSent,
}: {
  account: Account;
  dir: DirEntry[];
  to: string;
  setTo: (to: string) => void;
  onSent: () => void;
}) {
  const others = dir.filter((u) => u.username !== account.username);
  const recipient = others.find((u) => u.username === to);
  const [keyOk, setKeyOk] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [sealed, setSealed] = useState<Sealed | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Vérifie localement que l'empreinte annoncée correspond bien à la clé publique reçue
  useEffect(() => {
    let alive = true;
    if (recipient) fingerprint("RSA", recipient.publicKey).then((fp) => alive && setKeyOk(fp === recipient.fingerprint));
    return () => {
      alive = false;
    };
  }, [recipient]);

  const reset = () => {
    setSealed(null);
    setSteps([]);
    setSentId(null);
    setError("");
  };

  const encrypt = async () => {
    if (!recipient || !text.trim()) return;
    reset();
    setBusy(true);
    try {
      const msg = text.trim();
      const bytes = new TextEncoder().encode(msg).length;
      const a = await seal(msg, recipient.publicKey);
      const b = await seal(msg, account.publicKey);
      let shown: string[] = [];
      await playSteps(
        [
          `> encrypt --to ${recipient.username} --pub ${recipient.username}.pub`,
          `[*] Clé publique de ${recipient.username} prise dans l'annuaire : n sur ${bitsOf(recipient.publicKey)} bits, e = ${BigInt("0x" + recipient.publicKey.e)}`,
          `[+] Empreinte vérifiée localement : ${recipient.fingerprint.slice(0, 20)}…`,
          `[*] Message encodé en UTF-8 : ${bytes} octet${bytes > 1 ? "s" : ""}`,
          ...a.trace,
          `[*] c = 0x${shortHex(a.env.blocks[0], 16)}`,
          `[*] Copie pour toi, chiffrée avec TA clé publique (pour relire tes envois)`,
          `[+] Chiffré : ${a.env.blocks.length} bloc${a.env.blocks.length > 1 ? "s" : ""} RSA, prêt à être diffusé`,
        ],
        (l) => {
          shown = [...shown, l];
          setSteps(shown);
        },
      );
      setSealed({ forRecipient: a.env, forMe: b.env, text: msg, to: recipient.username });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const broadcast = async () => {
    if (!sealed) return;
    setBusy(true);
    setError("");
    try {
      let log = [...steps, "> broadcast --network", "[*] Envoi au serveur du réseau…"];
      setSteps(log);
      const r = await api<{ id: number }>("/api/messages", {
        to: sealed.to,
        envRecipient: sealed.forRecipient,
        envSender: sealed.forMe,
      });
      await playSteps(
        [
          `[+] Message #${r.id} diffusé à tous les utilisateurs du réseau`,
          `[i] Tout le monde le voit dans « Réseau », mais seul ${sealed.to} peut le déchiffrer avec sa clé privée`,
        ],
        (l) => {
          log = [...log, l];
          setSteps(log);
        },
      );
      setSentId(r.id);
      setText("");
      setSealed(null);
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Step n={1} title="Choisir le destinataire et récupérer sa clé publique" done={!!recipient}>
        {others.length === 0 ? (
          <p className="text-xs text-mute">Personne d&apos;autre n&apos;a encore publié de clé. Invite ton correspondant à créer un compte.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {others.map((u) => (
              <button
                key={u.username}
                onClick={() => {
                  setTo(u.username);
                  reset();
                }}
                className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition ${
                  to === u.username ? "border-neon bg-neon/15 text-neon" : "border-line text-ink hover:border-line-strong"
                }`}
              >
                <Avatar name={u.username} size="sm" />
                {u.username}
              </button>
            ))}
          </div>
        )}
        {recipient && (
          <div className="mt-3 space-y-1 rounded border border-cyan/30 bg-cyan/[0.04] p-3 text-[11px]">
            <div className="text-cyan">🔑 Clé publique de {recipient.username}</div>
            <div className="break-all text-mute">
              n = 0x{shortHex(recipient.publicKey.n, 28)} <span className="text-mute/70">({bitsOf(recipient.publicKey)} bits)</span>
            </div>
            <div className="text-mute">e = {BigInt("0x" + recipient.publicKey.e).toString()}</div>
            <div className="text-mute">empreinte {recipient.fingerprint}</div>
            {keyOk === false && <Alert>L&apos;empreinte ne correspond pas à la clé reçue : n&apos;envoie rien.</Alert>}
          </div>
        )}
      </Step>

      <Step n={2} title="Écrire le message en clair" done={!!text.trim()}>
        <textarea
          className={`${inputClass} h-24 resize-y`}
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, MAX_CHARS));
            if (sealed) reset();
          }}
          placeholder={recipient ? `Message secret pour ${recipient.username}…` : "Choisis d'abord un destinataire"}
          disabled={!recipient}
        />
      </Step>

      <Step n={3} title="Chiffrer avec la clé publique du destinataire" done={!!sealed || sentId !== null}>
        <Button variant="primary" onClick={encrypt} disabled={!recipient || !text.trim() || busy || keyOk === false}>
          🔒 Chiffrer avec la clé publique de {recipient?.username ?? "…"}
        </Button>
      </Step>

      {steps.length > 0 && <StepLog steps={steps} running={busy} />}

      {sealed && (
        <div className="rise space-y-2">
          <Label>Ce qui va circuler sur le réseau (visible par tous)</Label>
          <div className="line-clamp-4 rounded border border-line bg-void p-2.5 text-[10.5px] break-all text-cyan/80">
            {sealed.forRecipient.blocks.join("")}
          </div>
        </div>
      )}

      <Step n={4} title="Diffuser sur le réseau" done={sentId !== null}>
        <Button variant="primary" onClick={broadcast} disabled={!sealed || busy}>
          📡 Diffuser sur le réseau
        </Button>
        {sentId !== null && (
          <p className="mt-2 text-xs text-neon">
            ✓ Message #{sentId} diffusé. Va dans l&apos;onglet Réseau : tout le monde le voit, seul le destinataire peut le lire.
          </p>
        )}
      </Step>

      {error && <Alert>{error}</Alert>}
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="flex gap-3">
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
          done ? "border-neon bg-neon/15 text-neon" : "border-line text-mute"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        {children}
      </div>
    </section>
  );
}
