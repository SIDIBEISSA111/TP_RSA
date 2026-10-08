"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui";
import { fingerprint, getScheme, type Envelope, type KeyRecord } from "@/lib/crypto/registry";
import { api, type Account } from "@/lib/client/account";

interface Partner {
  username: string;
  fingerprint: string;
  publicKey: KeyRecord;
}

interface ChatMessage {
  id: number;
  fromMe: boolean;
  createdAt: string;
  env: Envelope;
  text?: string;
  error?: string;
}

const MAX_CHARS = 2000;

async function seal(text: string, pub: KeyRecord): Promise<Envelope> {
  const r = getScheme("RSA").encrypt(text, pub);
  return { v: 1, alg: "RSA", kid: await fingerprint("RSA", pub), mode: r.mode, blocks: r.blocks };
}

export function Thread({ account, partnerName, onBack, onActivity }: {
  account: Account;
  partnerName: string;
  onBack: () => void;
  onActivity: (lastId: number) => void;
}) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [tampered, setTampered] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showFp, setShowFp] = useState(false);
  const lastId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  const decryptAll = useCallback(
    (list: Omit<ChatMessage, "text" | "error">[]): ChatMessage[] =>
      list.map((m) => {
        try {
          return { ...m, text: getScheme(m.env.alg).decrypt(m.env, account.privateKey).text };
        } catch (err) {
          return { ...m, error: (err as Error).message };
        }
      }),
    [account.privateKey],
  );

  const append = useCallback(
    (incoming: ChatMessage[]) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...prev, ...incoming.filter((m) => !known.has(m.id))].sort((a, b) => a.id - b.id);
      });
      lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
      onActivity(lastId.current);
    },
    [onActivity],
  );

  // Clé publique du correspondant (et vérification de l'empreinte annoncée par le serveur)
  useEffect(() => {
    let alive = true;
    api<Partner>(`/api/users?username=${encodeURIComponent(partnerName)}`)
      .then(async (p) => {
        if (!alive) return;
        setPartner(p);
        setTampered((await fingerprint("RSA", p.publicKey)) !== p.fingerprint);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [partnerName]);

  // Chargement puis récupération régulière des nouveaux messages
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (document.visibilityState === "visible" || lastId.current === 0) {
          const list = await api<ChatMessage[]>(
            `/api/messages?with=${encodeURIComponent(partnerName)}&after=${lastId.current}`,
          );
          if (!alive) return;
          append(decryptAll(list));
          setLoaded(true);
        }
      } catch {
        // réseau coupé : on réessaie au prochain tour
      }
      if (alive) timer = setTimeout(poll, 2500);
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [partnerName, append, decryptAll]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !partner || sending) return;
    setSending(true);
    setError("");
    try {
      // Deux exemplaires : un pour le destinataire, un pour moi (pour relire mes propres messages)
      const [envRecipient, envSender] = await Promise.all([seal(text, partner.publicKey), seal(text, account.publicKey)]);
      const r = await api<{ id: number; createdAt: string }>("/api/messages", { to: partner.username, envRecipient, envSender });
      append([{ id: r.id, fromMe: true, createdAt: r.createdAt, env: envSender, text }]);
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-line bg-panel-2 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-mute hover:text-neon md:hidden" aria-label="Retour">
            ←
          </button>
          <Avatar name={partnerName} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{partnerName}</div>
            <button onClick={() => setShowFp(!showFp)} className="text-[10.5px] text-neon-dim hover:text-neon">
              🛡 {partner ? partner.fingerprint.slice(0, 14) + "…" : "…"} · vérifier
            </button>
          </div>
          <span className="hidden rounded border border-neon/40 px-2 py-1 text-[10px] text-neon sm:inline">RSA-2048 · E2E</span>
        </div>
        {showFp && partner && (
          <div className="rise mt-2.5 space-y-1.5 rounded border border-line bg-void p-3 text-[11px] leading-relaxed">
            <div className="text-mute">
              Compare ces empreintes avec {partnerName}, de vive voix ou en personne. Si elles sont identiques, personne (pas même le
              serveur) n&apos;a remplacé vos clés.
            </div>
            <div>
              <span className="text-mute">{partnerName} : </span>
              <span className="text-cyan">{partner.fingerprint}</span>
            </div>
            <div>
              <span className="text-mute">toi : </span>
              <span className="text-neon">{account.fingerprint}</span>
            </div>
          </div>
        )}
      </header>

      {tampered && (
        <div className="p-3">
          <Alert>L&apos;empreinte annoncée par le serveur ne correspond pas à la clé publique reçue. N&apos;envoie rien.</Alert>
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {loaded && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs text-center text-xs leading-relaxed text-mute">
            <div className="mb-2 text-2xl">🔐</div>
            Aucun message. Le premier sera chiffré avec la clé publique de <span className="text-neon">{partnerName}</span> : lui seul pourra le lire.
          </div>
        )}
        {!loaded && <div className="cursor text-center text-xs text-mute">déchiffrement</div>}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={bottom} />
      </div>

      <div className="border-t border-line bg-panel-2 p-2.5">
        {error && (
          <div className="mb-2">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={onKey}
            rows={1}
            placeholder={partner ? `Message chiffré pour ${partnerName}…` : "Chargement de la clé publique…"}
            disabled={!partner || tampered}
            className="scroll-thin max-h-32 min-h-11 flex-1 resize-none rounded border border-line bg-void px-3 py-2.5 text-sm outline-none focus:border-neon"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || !partner || sending || tampered}
            className="grid size-11 shrink-0 place-items-center rounded border border-neon bg-neon/15 text-neon transition hover:bg-neon hover:text-void disabled:opacity-30"
            aria-label="Envoyer"
          >
            {sending ? "…" : "➤"}
          </button>
        </div>
        <div className="mt-1 flex justify-between px-1 text-[10px] text-mute/70">
          <span>Entrée pour envoyer · Maj+Entrée pour aller à la ligne</span>
          {draft.length > MAX_CHARS * 0.8 && <span>{draft.length}/{MAX_CHARS}</span>}
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const [raw, setRaw] = useState(false);
  const time = new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg border px-3 py-2 sm:max-w-[70%] ${
          m.fromMe ? "rounded-br-sm border-neon/40 bg-neon/10" : "rounded-bl-sm border-line-strong bg-panel"
        }`}
      >
        {raw ? (
          <div className="text-[10.5px] leading-relaxed break-all text-cyan">
            <div className="mb-1 text-mute">
              {m.env.blocks.length} bloc(s) RSA · clé {m.env.kid.slice(0, 11)}…
            </div>
            {m.env.blocks[0].slice(0, 180)}…
          </div>
        ) : m.error ? (
          <div className="text-xs text-danger">⚠ Illisible : {m.error}</div>
        ) : (
          <div className="text-sm break-words whitespace-pre-wrap">{m.text}</div>
        )}
        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-mute">
          <button onClick={() => setRaw(!raw)} className="hover:text-neon" title="Voir ce que le serveur stocke">
            {raw ? "🔓 clair" : "🔒 chiffré"}
          </button>
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded border text-sm font-bold uppercase"
      style={{ borderColor: `hsl(${h} 90% 55% / 0.5)`, color: `hsl(${h} 90% 65%)`, background: `hsl(${h} 90% 50% / 0.08)` }}
    >
      {name.slice(0, 2)}
    </span>
  );
}
