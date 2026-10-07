// Format texte des clés et messages, copiable dans WhatsApp, un e-mail ou un fichier :
// -----BEGIN CIPHERLAB RSA PUBLIC KEY-----
// <JSON encodé en base64, lignes de 64 caractères>
// -----END CIPHERLAB RSA PUBLIC KEY-----

import type { Envelope, KeyRecord } from "./crypto/registry";

export type ArmorKind = "PUBLIC KEY" | "PRIVATE KEY" | "MESSAGE";

export interface KeyPayload {
  v: 1;
  alg: string;
  label: string;
  pub: KeyRecord;
  priv?: KeyRecord;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function armor(kind: ArmorKind, alg: string, payload: unknown): string {
  const body = toBase64(JSON.stringify(payload)).replace(/.{64}/g, "$&\n").trim();
  const tag = `CIPHERLAB ${alg} ${kind}`;
  return `-----BEGIN ${tag}-----\n${body}\n-----END ${tag}-----`;
}

export interface Unarmored {
  kind: ArmorKind;
  alg: string;
  payload: KeyPayload | Envelope;
}

export function unarmor(text: string): Unarmored {
  const m = text.match(/-----BEGIN CIPHERLAB (\S+) (PUBLIC KEY|PRIVATE KEY|MESSAGE)-----([\s\S]*?)-----END CIPHERLAB \1 \2-----/);
  if (!m) throw new Error("Bloc CIPHERLAB introuvable : colle le texte complet, lignes BEGIN et END comprises");
  try {
    const payload = JSON.parse(fromBase64(m[3].replace(/\s+/g, "")));
    return { alg: m[1], kind: m[2] as ArmorKind, payload };
  } catch {
    throw new Error("Bloc CIPHERLAB corrompu : il a peut-être été tronqué pendant la copie");
  }
}
