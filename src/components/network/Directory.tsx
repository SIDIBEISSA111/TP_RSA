"use client";

import { Avatar, bitsOf, shortHex, timeLabel, type DirEntry } from "./shared";

export function Directory({ dir, me, onWrite }: { dir: DirEntry[]; me: string; onWrite: (to: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-mute">
        Quand un utilisateur crée son compte, sa <b className="text-ink">clé publique (n, e)</b> est publiée ici, à la vue de tous.
        N&apos;importe qui peut s&apos;en servir pour lui chiffrer un message. Sa clé privée, elle, ne quitte jamais son navigateur
        en clair.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {dir.map((u) => {
          const mine = u.username === me;
          return (
            <div key={u.username} className={`rounded-lg border p-3.5 ${mine ? "border-neon/50 bg-neon/[0.04]" : "border-line bg-panel"}`}>
              <div className="flex items-center gap-2.5">
                <Avatar name={u.username} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {u.username} {mine && <span className="text-[10px] text-neon">(toi)</span>}
                  </div>
                  <div className="text-[10px] text-mute">publiée {timeLabel(u.publishedAt)}</div>
                </div>
                <span className="rounded border border-cyan/40 px-1.5 py-0.5 text-[10px] text-cyan">RSA-{bitsOf(u.publicKey)}</span>
              </div>
              <div className="mt-2.5 space-y-1 rounded border border-line bg-void p-2.5 text-[10.5px]">
                <div className="break-all">
                  <span className="text-neon-dim">n </span>
                  <span className="text-mute">0x{shortHex(u.publicKey.n, 30)}</span>
                </div>
                <div>
                  <span className="text-neon-dim">e </span>
                  <span className="text-mute">{BigInt("0x" + u.publicKey.e).toString()}</span>
                </div>
                <div className="break-all">
                  <span className="text-neon-dim">empreinte </span>
                  <span className="text-cyan">{u.fingerprint}</span>
                </div>
              </div>
              {!mine && (
                <button onClick={() => onWrite(u.username)} className="mt-2.5 text-[11px] text-neon hover:underline">
                  ✉ Chiffrer un message avec cette clé →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
