"use client";

// Compte utilisateur, côté navigateur.
//
// Du mot de passe, on dérive (PBKDF2-SHA256, 300 000 itérations) deux clés de 256 bits :
//   • authKey : envoyée au serveur pour prouver qu'on connaît le mot de passe ;
//   • encKey  : NE QUITTE JAMAIS le navigateur, elle chiffre la clé privée RSA (AES-256-GCM).
// Le serveur stocke donc une clé privée qu'il est incapable d'ouvrir.

import type { KeyRecord } from "@/lib/crypto/registry";
import { bytesToHex, hexToBytes, randomBytes } from "@/lib/crypto/math";

const PBKDF2_ITERATIONS = 300_000;

export interface Account {
  username: string;
  fingerprint: string;
  publicKey: KeyRecord;
  privateKey: KeyRecord;
}

export interface MeResponse {
  username: string;
  fingerprint: string;
  publicKey: KeyRecord;
  kdfSalt: string;
  encPrivateKey: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.error ?? `Erreur ${res.status}`);
  return data as T;
}

export function newSalt() {
  return bytesToHex(randomBytes(16));
}

export async function deriveKeys(password: string, kdfSaltHex: string) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(kdfSaltHex) as BufferSource, iterations: PBKDF2_ITERATIONS },
      base,
      512,
    ),
  );
  const authKey = bytesToHex(bits.subarray(0, 32));
  const encKey = await crypto.subtle.importKey("raw", bits.subarray(32) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { authKey, encKey };
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function sealPrivateKey(priv: KeyRecord, encKey: CryptoKey): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, encKey, new TextEncoder().encode(JSON.stringify(priv))),
  );
  return `${b64(iv)}.${b64(ct)}`;
}

export async function openPrivateKey(sealed: string, encKey: CryptoKey): Promise<KeyRecord> {
  const [iv, ct] = sealed.split(".");
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) as BufferSource }, encKey, unb64(ct) as BufferSource);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("Mot de passe incorrect : impossible de déverrouiller la clé privée");
  }
}

/** Génère une paire RSA dans un Web Worker (l'interface reste fluide). */
export function generateRsa(bits: number, onLog: (line: string) => void): Promise<KeyRecord> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("../../workers/rsa.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      if (e.data.type === "log") onLog(e.data.line);
      else {
        w.terminate();
        if (e.data.type === "done") resolve(e.data.record);
        else reject(new Error(e.data.message));
      }
    };
    w.postMessage({ bits });
  });
}

// Clé privée déverrouillée gardée pour l'onglet en cours seulement (effacée à la fermeture de l'onglet).
const SESSION_KEY = "cipherlab.account.v1";

export function loadUnlocked(username: string): Account | null {
  try {
    const a = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as Account | null;
    return a?.username === username ? a : null;
  } catch {
    return null;
  }
}

export function storeUnlocked(a: Account | null) {
  try {
    if (a) sessionStorage.setItem(SESSION_KEY, JSON.stringify(a));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // stockage indisponible : il faudra ressaisir le mot de passe au rechargement
  }
}
