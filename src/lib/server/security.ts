// Primitives de sécurité côté serveur.
// Le serveur ne voit jamais le mot de passe : il reçoit une « clé d'authentification »
// dérivée dans le navigateur (PBKDF2), qu'il hache encore une fois avec scrypt avant de la stocker.

import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.VERCEL) throw new Error("SESSION_SECRET manquant ou trop court");
  return "dev-only-secret-ne-pas-utiliser-en-production";
}

export function randomHex(bytes: number) {
  return randomBytes(bytes).toString("hex");
}

export function hashAuthKey(authKey: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) =>
    scrypt(authKey, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key.toString("hex")))),
  );
}

export async function verifyAuthKey(authKey: string, salt: string, expected: string) {
  const actual = Buffer.from(await hashAuthKey(authKey, salt), "hex");
  const exp = Buffer.from(expected, "hex");
  return actual.length === exp.length && timingSafeEqual(actual, exp);
}

/** Sel factice et stable pour un pseudo inexistant : on ne révèle pas quels comptes existent. */
export function fakeKdfSalt(username: string) {
  return createHmac("sha256", secret()).update("kdf:" + username).digest("hex").slice(0, 32);
}

export interface Session {
  uid: number;
  username: string;
  exp: number;
}

export const SESSION_COOKIE = "cl_session";
export const SESSION_TTL = 60 * 60 * 24 * 7;

export function signSession(s: Omit<Session, "exp">): string {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })).toString("base64url");
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

/** Même calcul que fingerprint() côté navigateur (src/lib/crypto/registry.ts). */
export function rsaFingerprint(n: string, e: string) {
  const digest = createHash("sha256").update(`RSA:${n}:${e}`).digest();
  return Array.from(digest.subarray(0, 10), (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}
