import {
  bigIntToBytes,
  bitLength,
  byteLength,
  bytesToBigInt,
  gcd,
  generatePrime,
  isProbablePrime,
  modInverse,
  modPow,
  randomBytes,
  type PrimeProgress,
} from "./math";

export interface RsaPublicKey {
  n: bigint;
  e: bigint;
}

export interface RsaPrivateKey extends RsaPublicKey {
  d: bigint;
  p: bigint;
  q: bigint;
  dp: bigint;
  dq: bigint;
  qi: bigint;
}

/** "pkcs1" : bourrage aléatoire PKCS#1 v1.5 (clés ≥ 96 bits).
 *  "textbook" : RSA brut caractère par caractère, uniquement pour les petites clés pédagogiques. */
export type RsaMode = "pkcs1" | "textbook";

export const DEFAULT_E = 65537n;

/** Construit une clé à partir de p, q, e en vérifiant chaque condition. Renvoie aussi le détail du calcul. */
export function buildKeyFromPrimes(p: bigint, q: bigint, e: bigint): { key: RsaPrivateKey; steps: string[] } {
  const steps: string[] = [];
  if (!isProbablePrime(p)) throw new Error(`p = ${p} n'est pas premier`);
  if (!isProbablePrime(q)) throw new Error(`q = ${q} n'est pas premier`);
  if (p === q) throw new Error("p et q doivent être différents");
  steps.push(`p = ${p}  ✓ premier`);
  steps.push(`q = ${q}  ✓ premier`);

  const n = p * q;
  steps.push(`n = p × q = ${n}  (${bitLength(n)} bits)`);
  const phi = (p - 1n) * (q - 1n);
  steps.push(`φ(n) = (p−1)(q−1) = ${phi}`);

  if (e <= 1n || e >= phi) throw new Error(`e doit vérifier 1 < e < φ(n) = ${phi}`);
  const g = gcd(e, phi);
  if (g !== 1n) throw new Error(`pgcd(e, φ(n)) = ${g} ≠ 1 : choisis un autre e (essaie ${suggestE(phi)})`);
  steps.push(`e = ${e}  ✓ pgcd(e, φ(n)) = 1`);

  const d = modInverse(e, phi);
  steps.push(`d = e⁻¹ mod φ(n) = ${d}`);
  steps.push(`vérification : e × d mod φ(n) = ${(e * d) % phi}`);

  const key: RsaPrivateKey = { n, e, d, p, q, dp: d % (p - 1n), dq: d % (q - 1n), qi: modInverse(q, p) };
  steps.push(`clé publique  (n, e) = (${short(n)}, ${e})`);
  steps.push(`clé privée    d = ${short(d)}`);
  return { key, steps };
}

function suggestE(phi: bigint): bigint {
  for (const c of [3n, 5n, 7n, 11n, 13n, 17n, 65537n]) if (c < phi && gcd(c, phi) === 1n) return c;
  for (let c = 3n; c < phi; c += 2n) if (gcd(c, phi) === 1n) return c;
  return 3n;
}

function short(n: bigint): string {
  const s = n.toString();
  return s.length > 40 ? `${s.slice(0, 18)}…${s.slice(-18)} (${s.length} chiffres)` : s;
}

export function generateKeyPair(
  bits: number,
  log: (line: string) => void = () => {},
): RsaPrivateKey {
  const half = bits / 2;
  for (;;) {
    log(`[*] Recherche de p (${half} bits) — crible + Miller-Rabin…`);
    const p = generatePrime(half, throttle((s) => log(`    candidats: ${s.candidates}  tests MR: ${s.millerRabinTests}`)));
    log(`[+] p trouvé : ${short(p)}`);
    log(`[*] Recherche de q (${half} bits)…`);
    const q = generatePrime(half, throttle((s) => log(`    candidats: ${s.candidates}  tests MR: ${s.millerRabinTests}`)));
    log(`[+] q trouvé : ${short(q)}`);
    const phi = (p - 1n) * (q - 1n);
    if (p === q || gcd(DEFAULT_E, phi) !== 1n) {
      log("[!] p, q incompatibles avec e = 65537, on recommence");
      continue;
    }
    const { key } = buildKeyFromPrimes(p, q, DEFAULT_E);
    log(`[+] n = p × q : ${bitLength(key.n)} bits`);
    log(`[+] d = e⁻¹ mod φ(n) calculé`);
    return key;
  }
}

function throttle(fn: (s: PrimeProgress) => void) {
  let last = 0;
  return (s: PrimeProgress) => {
    const now = Date.now();
    if (now - last > 400) {
      last = now;
      fn(s);
    }
  };
}

export function rsaModeFor(n: bigint): RsaMode {
  return byteLength(n) >= 12 ? "pkcs1" : "textbook";
}

export interface RsaEncryption {
  mode: RsaMode;
  blocks: bigint[];
  trace: string[];
}

export function encrypt(text: string, pub: RsaPublicKey): RsaEncryption {
  const data = new TextEncoder().encode(text);
  const mode = rsaModeFor(pub.n);
  const trace: string[] = [];
  const blocks: bigint[] = [];

  if (mode === "textbook") {
    if (pub.n <= 255n) throw new Error("n doit être > 255 pour chiffrer octet par octet");
    trace.push(`[i] Petite clé : RSA « textbook », un octet à la fois — c = mᵉ mod n`);
    data.forEach((m, i) => {
      const c = modPow(BigInt(m), pub.e, pub.n);
      blocks.push(c);
      if (i < 24) trace.push(`    '${printable(m)}'  m=${m}  →  ${m}^${pub.e} mod ${pub.n} = ${c}`);
    });
    if (data.length > 24) trace.push(`    … ${data.length - 24} octets de plus`);
    return { mode, blocks, trace };
  }

  const k = byteLength(pub.n);
  const chunk = k - 11;
  trace.push(`[i] Bourrage PKCS#1 v1.5 : blocs de ${chunk} octets max, k = ${k} octets`);
  for (let off = 0; off < Math.max(data.length, 1); off += chunk) {
    const part = data.subarray(off, off + chunk);
    const em = pkcs1Pad(part, k);
    const m = bytesToBigInt(em);
    const c = modPow(m, pub.e, pub.n);
    blocks.push(c);
    trace.push(`[+] bloc ${blocks.length} : ${part.length} octets → m (${bitLength(m)} bits) → c = mᵉ mod n`);
  }
  return { mode, blocks, trace };
}

export function decrypt(mode: RsaMode, blocks: bigint[], key: RsaPrivateKey): { text: string; trace: string[] } {
  const trace: string[] = [`[i] Déchiffrement m = cᵈ mod n, accéléré par le théorème des restes chinois`];
  const out: number[] = [];
  blocks.forEach((c, i) => {
    if (c >= key.n) throw new Error("Bloc chiffré plus grand que n : mauvaise clé ?");
    const m = crtDecrypt(c, key);
    if (mode === "textbook") {
      if (m > 255n) throw new Error("Résultat incohérent : ce message n'a pas été chiffré pour cette clé");
      out.push(Number(m));
      if (i < 24) trace.push(`    ${c}^d mod n = ${m}  →  '${printable(Number(m))}'`);
    } else {
      const em = bigIntToBytes(m, byteLength(key.n));
      const part = pkcs1Unpad(em);
      out.push(...part);
      trace.push(`[+] bloc ${i + 1} : bourrage vérifié, ${part.length} octets récupérés`);
    }
  });
  if (mode === "textbook" && blocks.length > 24) trace.push(`    … ${blocks.length - 24} octets de plus`);
  return { text: new TextDecoder().decode(new Uint8Array(out)), trace };
}

/** m = cᵈ mod n via CRT : deux exponentiations sur des nombres deux fois plus petits. */
export function crtDecrypt(c: bigint, k: RsaPrivateKey): bigint {
  const m1 = modPow(c, k.dp, k.p);
  const m2 = modPow(c, k.dq, k.q);
  let h = (k.qi * (m1 - m2)) % k.p;
  if (h < 0n) h += k.p;
  return m2 + h * k.q;
}

/** EM = 0x00 ‖ 0x02 ‖ PS (≥ 8 octets aléatoires non nuls) ‖ 0x00 ‖ M */
export function pkcs1Pad(msg: Uint8Array, k: number): Uint8Array {
  const psLen = k - 3 - msg.length;
  if (psLen < 8) throw new Error("Message trop long pour un bloc");
  const ps = randomBytes(psLen);
  for (let i = 0; i < ps.length; i++) while (ps[i] === 0) ps[i] = randomBytes(1)[0];
  const em = new Uint8Array(k);
  em[1] = 0x02;
  em.set(ps, 2);
  em.set(msg, 3 + psLen);
  return em;
}

function pkcs1Unpad(em: Uint8Array): Uint8Array {
  if (em[0] !== 0x00 || em[1] !== 0x02) throw new Error("Bourrage invalide : mauvaise clé privée ?");
  const sep = em.indexOf(0, 2);
  if (sep < 10) throw new Error("Bourrage invalide : mauvaise clé privée ?");
  return em.subarray(sep + 1);
}

function printable(b: number): string {
  return b >= 32 && b < 127 ? String.fromCharCode(b) : "·";
}
