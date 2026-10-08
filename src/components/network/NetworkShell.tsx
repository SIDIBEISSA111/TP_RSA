"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui";
import { api, type Account } from "@/lib/client/account";
import { Compose } from "./Compose";
import { Directory } from "./Directory";
import { Feed } from "./Feed";
import { MyKeys } from "./MyKeys";
import { Avatar, type Attempt, type DirEntry, type NetMessage } from "./shared";

type Tab = "network" | "compose" | "directory" | "keys";

const SEEN_KEY = (me: string) => `cipherlab.seen.${me}`;

function loadSeen(me: string): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY(me))) || 0;
  } catch {
    return 0;
  }
}

export function NetworkShell({ account, fresh, onLogout }: { account: Account; fresh: boolean; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>(fresh ? "keys" : "network");
  const [dir, setDir] = useState<DirEntry[]>([]);
  const [messages, setMessages] = useState<NetMessage[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [to, setTo] = useState("");
  const [seen, setSeen] = useState(() => loadSeen(account.username));
  const lastId = useRef(0);

  const loadDir = useCallback(async () => {
    try {
      setDir(await api<DirEntry[]>("/api/directory"));
    } catch {
      // nouvel essai au prochain tour
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const fresh = await api<NetMessage[]>(`/api/network?after=${lastId.current}`);
      if (!fresh.length) return;
      lastId.current = Math.max(lastId.current, ...fresh.map((m) => m.id));
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...prev, ...fresh.filter((m) => !known.has(m.id))];
      });
    } catch {
      // nouvel essai au prochain tour
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => {
      loadDir();
      loadMessages();
    }, 0);
    const visible = () => document.visibilityState === "visible";
    const m = setInterval(() => visible() && loadMessages(), 3000);
    const d = setInterval(() => visible() && loadDir(), 10000);
    return () => {
      clearTimeout(first);
      clearInterval(m);
      clearInterval(d);
    };
  }, [loadDir, loadMessages]);

  // Les messages pour moi sont « vus » quand j'ouvre l'onglet Réseau
  const maxForMe = Math.max(0, ...messages.filter((m) => m.to === account.username).map((m) => m.id));
  const unread = messages.filter((m) => m.to === account.username && m.id > seen).length;
  useEffect(() => {
    if (tab !== "network" || maxForMe <= seen) return;
    const t = setTimeout(() => {
      setSeen(maxForMe);
      try {
        localStorage.setItem(SEEN_KEY(account.username), String(maxForMe));
      } catch {
        // stockage indisponible
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [tab, maxForMe, seen, account.username]);

  const setAttempt = useCallback((key: string, a: Attempt) => setAttempts((prev) => ({ ...prev, [key]: a })), []);

  const write = (username: string) => {
    setTo(username);
    setTab("compose");
  };

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "network", label: "📡 Réseau", badge: unread },
    { id: "compose", label: "✉ Chiffrer & envoyer" },
    { id: "directory", label: "🔑 Annuaire des clés" },
    { id: "keys", label: "👤 Mes clés" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={account.username} />
        <div className="min-w-0 flex-1">
          <div className="text-xs tracking-[0.3em] text-cyan glow-cyan">{"// RÉSEAU CHIFFRÉ RSA"}</div>
          <div className="truncate text-sm">
            connecté : <b className="text-neon">{account.username}</b>{" "}
            <span className="text-[10px] text-mute">🛡 {account.fingerprint.slice(0, 20)}…</span>
          </div>
        </div>
        <button onClick={onLogout} className="rounded border border-line px-2.5 py-1.5 text-[11px] text-mute hover:border-danger hover:text-danger">
          quitter
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative rounded-t border-b-2 px-2 py-2.5 text-left text-xs transition sm:text-sm ${
              tab === t.id ? "border-neon bg-neon/10 text-neon" : "border-line text-mute hover:text-ink"
            }`}
          >
            {t.label}
            {!!t.badge && (
              <span className="ml-1.5 rounded-full bg-neon px-1.5 text-[10px] font-bold text-void shadow-[0_0_8px_var(--color-neon)]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <Panel title={`reseau/${tab}.sh`}>
        <div hidden={tab !== "network"}>
          <Feed account={account} messages={messages} dir={dir} attempts={attempts} setAttempt={setAttempt} onWrite={write} />
        </div>
        <div hidden={tab !== "compose"}>
          <Compose account={account} dir={dir} to={to} setTo={setTo} onSent={loadMessages} />
        </div>
        <div hidden={tab !== "directory"}>
          <Directory dir={dir} me={account.username} onWrite={write} />
        </div>
        <div hidden={tab !== "keys"}>
          <MyKeys account={account} fresh={fresh} />
        </div>
      </Panel>
    </div>
  );
}
