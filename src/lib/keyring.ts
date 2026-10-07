"use client";

// Trousseau local : mes paires de clés + les clés publiques de mes contacts.
// Stocké dans le navigateur (localStorage) : rien ne part sur un serveur.

import { useSyncExternalStore } from "react";
import type { KeyRecord } from "./crypto/registry";

export interface KeyEntry {
  id: string;
  alg: string;
  label: string;
  /** "pair" : ma clé (avec partie privée) — "contact" : clé publique de quelqu'un d'autre */
  kind: "pair" | "contact";
  bits: number;
  fingerprint: string;
  createdAt: number;
  pub: KeyRecord;
  priv?: KeyRecord;
}

const STORAGE_KEY = "cipherlab.keyring.v1";
const EMPTY: KeyEntry[] = [];
let cache: KeyEntry[] | null = null;
const listeners = new Set<() => void>();

function read(): KeyEntry[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(entries: KeyEntry[]) {
  cache = entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // stockage indisponible (navigation privée…) : le trousseau reste en mémoire
  }
  listeners.forEach((l) => l());
}

export const keyring = {
  all: read,
  add(entry: Omit<KeyEntry, "id" | "createdAt">): KeyEntry {
    const existing = read().find((k) => k.fingerprint === entry.fingerprint);
    if (existing) {
      // Même clé déjà connue : on complète avec la partie privée si on la reçoit
      if (entry.priv && !existing.priv) {
        const upgraded: KeyEntry = { ...existing, kind: "pair", priv: entry.priv };
        write(read().map((k) => (k.id === existing.id ? upgraded : k)));
        return upgraded;
      }
      return existing;
    }
    const full: KeyEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
    write([full, ...read()]);
    return full;
  },
  remove(id: string) {
    write(read().filter((k) => k.id !== id));
  },
  rename(id: string, label: string) {
    write(read().map((k) => (k.id === id ? { ...k, label } : k)));
  },
  byFingerprint(fp: string) {
    return read().find((k) => k.fingerprint === fp);
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useKeyring(): KeyEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
