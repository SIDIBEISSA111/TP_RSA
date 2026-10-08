"use client";

import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/components/ui";
import { api, type Account } from "@/lib/client/account";
import { Avatar, Thread } from "./Thread";

interface Conversation {
  username: string;
  fingerprint: string;
  lastId: number;
  lastAt: string;
  lastFromMe: boolean;
}

interface Found {
  username: string;
  fingerprint: string;
}

// Dernier message lu par conversation, mémorisé dans ce navigateur pour les pastilles « non lu »
const READ_KEY = (me: string) => `cipherlab.read.${me}`;

function loadRead(me: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY(me)) ?? "{}");
  } catch {
    return {};
  }
}

export function ChatShell({ account, onLogout }: { account: Account; onLogout: () => void }) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [read, setRead] = useState<Record<string, number>>(() => loadRead(account.username));
  const [showMe, setShowMe] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setConvs(await api<Conversation[]>("/api/conversations"));
    } catch {
      // ignoré : nouvel essai au prochain tour
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(() => document.visibilityState === "visible" && refresh(), 6000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = setTimeout(() => {
      api<Found[]>(`/api/users?q=${encodeURIComponent(q)}`).then(setFound).catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const markRead = useCallback(
    (lastId: number) => {
      if (!active) return;
      setRead((prev) => {
        if ((prev[active] ?? 0) >= lastId) return prev;
        const next = { ...prev, [active]: lastId };
        try {
          localStorage.setItem(READ_KEY(account.username), JSON.stringify(next));
        } catch {
          // stockage indisponible : pastilles non mémorisées
        }
        return next;
      });
      refresh();
    },
    [active, account.username, refresh],
  );

  const open = (name: string) => {
    setActive(name);
    setQuery("");
    setFound([]);
  };

  const list = active && !convs.some((c) => c.username === active)
    ? [{ username: active, fingerprint: "", lastId: 0, lastAt: "", lastFromMe: true }, ...convs]
    : convs;

  return (
    <div className="mx-auto h-[calc(100dvh-57px)] max-w-6xl md:p-4">
      <div className="grid h-full overflow-hidden border-line bg-panel/90 md:grid-cols-[300px_1fr] md:rounded-lg md:border md:box-glow">
        <aside className={`flex min-h-0 flex-col border-r border-line ${active ? "hidden md:flex" : "flex"}`}>
          <div className="border-b border-line bg-panel-2 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={account.username} />
              <button onClick={() => setShowMe(!showMe)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-semibold text-neon">{account.username}</div>
                <div className="truncate text-[10px] text-mute">🛡 {account.fingerprint.slice(0, 20)}…</div>
              </button>
              <button onClick={onLogout} className="rounded border border-line px-2 py-1 text-[10px] text-mute hover:border-danger hover:text-danger">
                quitter
              </button>
            </div>
            {showMe && (
              <div className="rise mt-2.5 space-y-2 rounded border border-line bg-void p-2.5 text-[10.5px]">
                <div className="break-all text-mute">
                  Ton empreinte : <span className="text-neon">{account.fingerprint}</span>
                </div>
                <div className="text-mute">Ta clé privée est déverrouillée pour cet onglet uniquement.</div>
                <CopyButton text={account.fingerprint} label="Copier l'empreinte" />
              </div>
            )}
            <div className="relative mt-3">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!e.target.value.trim()) setFound([]);
                }}
                placeholder="🔍 Chercher un pseudo…"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded border border-line bg-void px-3 py-2 text-sm outline-none focus:border-neon"
              />
              {query && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded border border-line-strong bg-panel shadow-xl">
                  {found.length === 0 && <div className="px-3 py-2 text-xs text-mute">Aucun utilisateur</div>}
                  {found.map((f) => (
                    <button
                      key={f.username}
                      onClick={() => open(f.username)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-neon/10"
                    >
                      <Avatar name={f.username} />
                      <span className="text-sm">{f.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && (
              <li className="p-5 text-center text-xs leading-relaxed text-mute">
                Aucune conversation. Cherche le pseudo de ton correspondant ci-dessus pour lui écrire.
              </li>
            )}
            {list.map((c) => {
              const unread = !c.lastFromMe && c.lastId > (read[c.username] ?? 0) && c.username !== active;
              return (
                <li key={c.username}>
                  <button
                    onClick={() => open(c.username)}
                    className={`flex w-full items-center gap-3 border-b border-line/60 px-3 py-3 text-left transition ${
                      active === c.username ? "bg-neon/10" : "hover:bg-panel-2"
                    }`}
                  >
                    <Avatar name={c.username} />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm ${unread ? "font-bold text-ink" : ""}`}>{c.username}</div>
                      <div className="truncate text-[11px] text-mute">
                        {c.lastAt ? `${c.lastFromMe ? "toi : " : ""}🔒 message chiffré` : "nouvelle conversation"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.lastAt && <span className="text-[10px] text-mute">{shortTime(c.lastAt)}</span>}
                      {unread && <span className="size-2.5 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className={`min-h-0 ${active ? "flex flex-col" : "hidden md:flex md:flex-col"}`}>
          {active ? (
            <Thread key={active} account={account} partnerName={active} onBack={() => setActive(null)} onActivity={markRead} />
          ) : (
            <div className="m-auto max-w-sm p-6 text-center">
              <div className="mb-3 font-display text-5xl text-line-strong">⌬</div>
              <p className="text-sm text-mute">
                Choisis une conversation, ou cherche un pseudo pour envoyer ton premier message chiffré.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function shortTime(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
