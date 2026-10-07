// Registre des méthodes de chiffrement.
// Ajouter une méthode = écrire son module (comme rsa.ts) puis l'enregistrer ici :
// l'interface (sélecteur, chiffrement, déchiffrement, trousseau) s'adapte toute seule.

import { bitLength } from "./math";
import * as rsa from "./rsa";

/** Valeurs de clé sérialisées en hexadécimal, ex. { n: "c3a1…", e: "10001" } */
export type KeyRecord = Record<string, string>;

export interface Envelope {
  v: 1;
  alg: string;
  /** Empreinte de la clé publique du destinataire */
  kid: string;
  mode: string;
  blocks: string[];
}

export interface SchemeResult {
  trace: string[];
}

export interface CipherScheme {
  id: string;
  name: string;
  tagline: string;
  /** Champs publics, dans l'ordre utilisé pour l'empreinte */
  publicFields: string[];
  bits(pub: KeyRecord): number;
  encrypt(text: string, pub: KeyRecord): SchemeResult & { mode: string; blocks: string[] };
  decrypt(env: Envelope, priv: KeyRecord): SchemeResult & { text: string };
}

export interface SchemeInfo {
  id: string;
  name: string;
  tagline: string;
  year: string;
  ready: boolean;
}

const hex = (n: bigint) => n.toString(16);
const big = (h: string) => BigInt("0x" + h);

export function rsaPublicRecord(k: rsa.RsaPublicKey): KeyRecord {
  return { n: hex(k.n), e: hex(k.e) };
}

export function rsaPrivateRecord(k: rsa.RsaPrivateKey): KeyRecord {
  return { n: hex(k.n), e: hex(k.e), d: hex(k.d), p: hex(k.p), q: hex(k.q), dp: hex(k.dp), dq: hex(k.dq), qi: hex(k.qi) };
}

export function rsaFromRecord(r: KeyRecord): rsa.RsaPrivateKey {
  return { n: big(r.n), e: big(r.e), d: big(r.d), p: big(r.p), q: big(r.q), dp: big(r.dp), dq: big(r.dq), qi: big(r.qi) };
}

const RSA: CipherScheme = {
  id: "RSA",
  name: "RSA",
  tagline: "Rivest · Shamir · Adleman — factorisation des grands entiers",
  publicFields: ["n", "e"],
  bits: (pub) => bitLength(big(pub.n)),
  encrypt(text, pub) {
    const r = rsa.encrypt(text, { n: big(pub.n), e: big(pub.e) });
    return { mode: r.mode, blocks: r.blocks.map(hex), trace: r.trace };
  },
  decrypt(env, priv) {
    return rsa.decrypt(env.mode as rsa.RsaMode, env.blocks.map(big), rsaFromRecord(priv));
  },
};

const IMPLEMENTED: Record<string, CipherScheme> = { RSA };

export const SCHEMES: SchemeInfo[] = [
  { id: "RSA", name: "RSA", tagline: "Factorisation de n = p × q", year: "1977", ready: true },
  { id: "ELGAMAL", name: "ElGamal", tagline: "Logarithme discret", year: "1985", ready: false },
  { id: "RABIN", name: "Rabin", tagline: "Racines carrées modulaires", year: "1979", ready: false },
  { id: "ECC", name: "ECIES", tagline: "Courbes elliptiques", year: "1985", ready: false },
  { id: "PAILLIER", name: "Paillier", tagline: "Chiffrement homomorphe", year: "1999", ready: false },
];

export function getScheme(id: string): CipherScheme {
  const s = IMPLEMENTED[id];
  if (!s) throw new Error(`Méthode « ${id} » pas encore disponible`);
  return s;
}

/** Empreinte SHA-256 de la clé publique, affichée sous forme AB:CD:… */
export async function fingerprint(alg: string, pub: KeyRecord): Promise<string> {
  const scheme = getScheme(alg);
  const material = [alg, ...scheme.publicFields.map((f) => pub[f])].join(":");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material)));
  return Array.from(digest.subarray(0, 10), (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}
