"use client";

import { useState } from "react";
import type { Account } from "@/lib/client/account";
import {
  Avatar,
  StepLog,
  bitsOf,
  decryptSteps,
  playSteps,
  shortHex,
  timeLabel,
  type Attempt,
  type DirEntry,
  type NetMessage,
} from "./shared";

type Filter = "all" | "mine" | "sent" | "keys";

type Event =
  | { kind: "key"; at: string; key: DirEntry }
  | { kind: "msg"; at: string; msg: NetMessage };

export function Feed({
  account,
  messages,
  dir,
  attempts,
  setAttempt,
  onWrite,
}: {
  account: Account;
  messages: NetMessage[];
  dir: DirEntry[];
  attempts: Record<string, Attempt>;
  setAttempt: (key: string, a: Attempt) => void;
  onWrite: (to: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const me = account.username;

  const events: Event[] = [
    ...dir.map((k) => ({ kind: "key" as const, at: k.publishedAt, key: k })),
    ...messages.map((m) => ({ kind: "msg" as const, at: m.createdAt, msg: m })),
  ]
    .filter((e) => {
      if (filter === "keys") return e.kind === "key";
      if (e.kind === "key") return filter === "all";
      if (filter === "mine") return e.msg.to === me;
      if (filter === "sent") return e.msg.from === me;
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  const counts = {
    all: dir.length + messages.length,
    mine: messages.filter((m) => m.to === me).length,
    sent: messages.filter((m) => m.from === me).length,
    keys: dir.length,
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-mute">
        Tout ce qui circule sur le réseau est visible par <b className="text-ink">tous les utilisateurs</b> : les clés publiques
        publiées et les messages chiffrés. Chacun peut essayer de déchiffrer n&apos;importe quel message avec sa clé privée,
        mais seul le vrai destinataire y arrivera.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "Tout"],
            ["mine", "📬 Pour moi"],
            ["sent", "📤 Envoyés"],
            ["keys", "🔑 Clés publiées"],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded border px-2.5 py-1.5 text-xs transition ${
              filter === f ? "border-neon bg-neon/15 text-neon" : "border-line text-mute hover:text-ink"
            }`}
          >
            {label} <span className="opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {events.length === 0 && (
        <div className="rounded border border-dashed border-line p-8 text-center text-xs text-mute">
          Rien ici pour le moment.
        </div>
      )}

      <ul className="space-y-3">
        {events.map((e) =>
          e.kind === "key" ? (
            <KeyEvent key={`k-${e.key.username}`} entry={e.key} me={me} onWrite={onWrite} />
          ) : (
            <MessageCard
              key={`m-${e.msg.id}`}
              msg={e.msg}
              account={account}
              attempt={attempts[`m-${e.msg.id}`]}
              copyAttempt={attempts[`c-${e.msg.id}`]}
              setAttempt={setAttempt}
            />
          ),
        )}
      </ul>
    </div>
  );
}

function KeyEvent({ entry, me, onWrite }: { entry: DirEntry; me: string; onWrite: (to: string) => void }) {
  const mine = entry.username === me;
  return (
    <li className="rise flex items-start gap-3 rounded-lg border border-cyan/25 bg-cyan/[0.03] p-3">
      <span className="mt-0.5 text-lg">🔑</span>
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex flex-wrap items-center gap-x-2">
          <b className="text-cyan">{mine ? "Toi" : entry.username}</b>
          <span className="text-mute">{mine ? "as publié ta clé publique sur le réseau" : "a publié sa clé publique sur le réseau"}</span>
          <span className="ml-auto text-[10px] text-mute">{timeLabel(entry.publishedAt)}</span>
        </div>
        <div className="mt-1.5 break-all text-[10.5px] text-mute">
          n = 0x{shortHex(entry.publicKey.n, 20)} ({bitsOf(entry.publicKey)} bits) · e = {BigInt("0x" + entry.publicKey.e).toString()} ·
          empreinte {entry.fingerprint.slice(0, 14)}…
        </div>
        {!mine && (
          <button onClick={() => onWrite(entry.username)} className="mt-2 text-[11px] text-neon hover:underline">
            ✉ Chiffrer un message pour {entry.username} →
          </button>
        )}
      </div>
    </li>
  );
}

function MessageCard({
  msg,
  account,
  attempt,
  copyAttempt,
  setAttempt,
}: {
  msg: NetMessage;
  account: Account;
  attempt?: Attempt;
  copyAttempt?: Attempt;
  setAttempt: (key: string, a: Attempt) => void;
}) {
  const me = account.username;
  const forMe = msg.to === me;
  const fromMe = msg.from === me;

  const run = async (key: string, copy: boolean) => {
    const env = copy && msg.senderEnv ? msg.senderEnv : msg.env;
    const result = decryptSteps(env, account, copy);
    let shown: string[] = [];
    setAttempt(key, { running: true, steps: [] });
    await playSteps(result.steps, (l) => {
      shown = [...shown, l];
      setAttempt(key, { running: true, steps: shown });
    });
    setAttempt(key, { running: false, steps: shown, ok: result.ok, text: result.text });
  };

  return (
    <li
      className={`rise rounded-lg border p-3.5 ${
        forMe ? "border-neon/50 bg-neon/[0.04] box-glow" : fromMe ? "border-line-strong bg-panel" : "border-line bg-panel/60"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-mute">✉ #{msg.id}</span>
        <Avatar name={msg.from} size="sm" />
        <b className={fromMe ? "text-neon" : "text-ink"}>{fromMe ? "toi" : msg.from}</b>
        <span className="text-mute">→</span>
        <Avatar name={msg.to} size="sm" />
        <b className={forMe ? "text-neon" : "text-ink"}>{forMe ? "toi" : msg.to}</b>
        {forMe && <span className="rounded bg-neon/15 px-1.5 py-0.5 text-[10px] text-neon">📬 pour toi</span>}
        {fromMe && <span className="rounded bg-line px-1.5 py-0.5 text-[10px] text-mute">📤 envoyé par toi</span>}
        <span className="ml-auto text-[10px] text-mute">{timeLabel(msg.createdAt)}</span>
      </div>

      <div className="mt-2.5 rounded border border-line bg-void p-2.5">
        <div className="mb-1 text-[10px] text-mute">
          Chiffré avec la clé publique de <span className="text-cyan">{forMe ? "toi" : msg.to}</span> · {msg.env.blocks.length} bloc
          {msg.env.blocks.length > 1 ? "s" : ""} RSA · ce que tout le monde voit :
        </div>
        <div className="line-clamp-3 text-[10.5px] break-all text-cyan/80">{msg.env.blocks.join("")}</div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => run(`m-${msg.id}`, false)}
          disabled={attempt?.running}
          className={`rounded border px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase transition disabled:opacity-40 ${
            forMe
              ? "border-neon bg-neon/15 text-neon hover:bg-neon hover:text-void"
              : "border-line-strong text-ink hover:border-neon hover:text-neon"
          }`}
        >
          🔓 Déchiffrer avec ma clé privée
        </button>
        {fromMe && msg.senderEnv && (
          <button
            onClick={() => run(`c-${msg.id}`, true)}
            disabled={copyAttempt?.running}
            className="rounded border border-line px-3 py-1.5 text-[11px] text-mute transition hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            Relire ma copie
          </button>
        )}
      </div>

      {[attempt, copyAttempt].map(
        (a, i) =>
          a && (
            <div key={i} className="mt-2.5 space-y-2">
              <StepLog steps={a.steps} running={a.running} />
              {!a.running && a.ok && (
                <div className="rise rounded border border-neon/50 bg-neon/10 p-3">
                  <div className="mb-1 text-[10px] tracking-widest text-neon uppercase">✓ Message en clair</div>
                  <p className="text-sm break-words whitespace-pre-wrap text-ink glow">{a.text}</p>
                </div>
              )}
              {!a.running && a.ok === false && (
                <div className="rise rounded border border-danger/50 bg-danger/10 p-3 text-xs text-danger">
                  ⛔ Accès refusé. Ce message est chiffré pour <b>{msg.to}</b> : sans sa clé privée, il reste illisible.
                </div>
              )}
            </div>
          ),
      )}
    </li>
  );
}
