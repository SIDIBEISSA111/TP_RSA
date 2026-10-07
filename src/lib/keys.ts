"use client";

import { armor, type KeyPayload } from "./armor";
import { fingerprint, getScheme, type KeyRecord } from "./crypto/registry";
import { keyring, type KeyEntry } from "./keyring";

export async function saveKey(alg: string, label: string, pub: KeyRecord, priv?: KeyRecord): Promise<KeyEntry> {
  const scheme = getScheme(alg);
  return keyring.add({
    alg,
    label: label.trim() || "Sans nom",
    kind: priv ? "pair" : "contact",
    bits: scheme.bits(pub),
    fingerprint: await fingerprint(alg, pub),
    pub,
    priv,
  });
}

export function publicArmor(k: KeyEntry): string {
  const payload: KeyPayload = { v: 1, alg: k.alg, label: k.label, pub: k.pub };
  return armor("PUBLIC KEY", k.alg, payload);
}

export function privateArmor(k: KeyEntry): string {
  const payload: KeyPayload = { v: 1, alg: k.alg, label: k.label, pub: k.pub, priv: k.priv };
  return armor("PRIVATE KEY", k.alg, payload);
}

export function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cle";
}
