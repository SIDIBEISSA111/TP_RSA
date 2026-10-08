"use client";

import { fingerprint, getScheme, type Envelope, type KeyRecord } from "@/lib/crypto/registry";
import type { Account } from "@/lib/client/account";

export interface DirEntry {
  username: string;
  fingerprint: string;
  publicKey: KeyRecord;
  publishedAt: string;
}

export interface NetMessage {
  id: number;
  from: string;
  to: string;
  createdAt: string;
  env: Envelope;
  senderEnv?: Envelope;
}

export interface Attempt {
  running: boolean;
  steps: string[];
  ok?: boolean;
  text?: string;
}

export const bitsOf = (pub: KeyRecord) => getScheme("RSA").bits(pub);

export function shortHex(hex: string, n = 24) {
  return hex.length > n * 2 ? `${hex.slice(0, n)}…${hex.slice(-n)}` : hex;
}

export function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Affiche les étapes une à une, pour qu'on voie le calcul se dérouler. */
export async function playSteps(lines: string[], push: (line: string) => void, delay = 170) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const line of lines) {
    push(line);
    if (!reduce) await sleep(delay);
  }
}

/** Tentative de déchiffrement avec MA clé privée, détaillée étape par étape (réussie ou non). */
export function decryptSteps(env: Envelope, account: Account, copy = false): { ok: boolean; steps: string[]; text?: string } {
  const steps = [
    `> decrypt --key ${account.username}.priv${copy ? " --copie-expediteur" : ""}`,
    `[*] Ma clé privée : d sur ${bitsOf(account.publicKey)} bits, empreinte ${account.fingerprint.slice(0, 14)}…`,
    `[*] Le message a été chiffré pour la clé ${env.kid.slice(0, 14)}…`,
    env.kid === account.fingerprint
      ? "[+] C'est ma clé publique : ma clé privée devrait l'ouvrir"
      : "[!] Ce n'est PAS ma clé publique : on essaie quand même…",
    `[*] c = 0x${shortHex(env.blocks[0], 16)}  (${env.blocks.length} bloc${env.blocks.length > 1 ? "s" : ""})`,
    "[*] Calcul de m = cᵈ mod n avec MA clé privée…",
  ];
  try {
    const r = getScheme(env.alg).decrypt(env, account.privateKey);
    steps.push(...r.trace.filter((l) => !l.startsWith("[i] Déchiffrement")), "[+] Message déchiffré ✓");
    return { ok: true, steps, text: r.text };
  } catch (err) {
    steps.push(
      `[!] ${(err as Error).message}`,
      "[!] Échec : seule la clé privée du destinataire peut ouvrir ce message.",
    );
    return { ok: false, steps };
  }
}

export async function seal(text: string, pub: KeyRecord): Promise<{ env: Envelope; trace: string[] }> {
  const r = getScheme("RSA").encrypt(text, pub);
  return { env: { v: 1, alg: "RSA", kid: await fingerprint("RSA", pub), mode: r.mode, blocks: r.blocks }, trace: r.trace };
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded border font-bold uppercase ${size === "sm" ? "size-7 text-[11px]" : "size-9 text-sm"}`}
      style={{ borderColor: `hsl(${h} 90% 55% / 0.5)`, color: `hsl(${h} 90% 65%)`, background: `hsl(${h} 90% 50% / 0.08)` }}
    >
      {name.slice(0, 2)}
    </span>
  );
}

export function StepLog({ steps, running }: { steps: string[]; running?: boolean }) {
  const color = (l: string) =>
    l.startsWith("[+]") ? "text-neon" : l.startsWith("[!]") ? "text-danger" : l.startsWith("[*]") ? "text-cyan" : l.startsWith("[i]") ? "text-amber" : l.startsWith(">") ? "text-ink" : "text-mute";
  return (
    <div className="rounded border border-line bg-void p-2.5 text-[11px] leading-relaxed">
      {steps.map((l, i) => (
        <div key={i} className={`break-all whitespace-pre-wrap ${color(l)}`}>
          {l}
        </div>
      ))}
      {running && <div className="cursor" />}
    </div>
  );
}
