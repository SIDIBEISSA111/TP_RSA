// Mode TITAN : RSA avec deux nombres premiers de plus d'un million de chiffres.
// Générer de tels premiers au hasard est hors de portée : on utilise deux premiers de Mersenne
// connus, p = 2^6972593 − 1 et q = 2^13466917 − 1, qui se reconstruisent à partir de leur exposant.

import { bytesToBigInt, modPow } from "@/lib/crypto/math";
import { pkcs1Pad } from "@/lib/crypto/rsa";

const TITAN_A = 6972593;
const TITAN_B = 13466917;

let p = 0n;
let q = 0n;
let N = 0n;

const post = (msg: Record<string, unknown>) => self.postMessage(msg);
const LOG10_2 = Math.log10(2);

/** Premiers chiffres décimaux de 2^bits (à 1 près) : 10^(partie fractionnaire de bits·log10 2) */
function leadingDigits(log10: number, count = 8): string {
  const frac = log10 - Math.floor(log10);
  return Math.floor(10 ** frac * 10 ** (count - 1)).toString();
}

function hexBitLength(n: bigint): number {
  const h = n.toString(16);
  return (h.length - 1) * 4 + parseInt(h[0], 16).toString(2).length;
}

const TAIL = 10n ** 24n;

function build() {
  const t0 = performance.now();
  p = (1n << BigInt(TITAN_A)) - 1n;
  q = (1n << BigInt(TITAN_B)) - 1n;
  const t1 = performance.now();
  N = p * q;
  const t2 = performance.now();
  const digits = (bits: number) => Math.floor(bits * LOG10_2) + 1;
  const tailP = modPow(2n, BigInt(TITAN_A), TAIL) - 1n;
  const tailQ = modPow(2n, BigInt(TITAN_B), TAIL) - 1n;
  const hex = N.toString(16);
  post({
    type: "built",
    buildMs: t1 - t0,
    mulMs: t2 - t1,
    p: { digits: digits(TITAN_A), head: leadingDigits(TITAN_A * LOG10_2), tail: tailP.toString().padStart(24, "0") },
    q: { digits: digits(TITAN_B), head: leadingDigits(TITAN_B * LOG10_2), tail: tailQ.toString().padStart(24, "0") },
    n: {
      digits: digits(TITAN_A + TITAN_B),
      bits: TITAN_A + TITAN_B,
      head: leadingDigits((TITAN_A + TITAN_B) * LOG10_2),
      tail: ((tailP * tailQ) % TAIL).toString().padStart(24, "0"),
      hexHead: hex.slice(0, 96),
      hexTail: hex.slice(-96),
      hexLength: hex.length,
    },
  });
}

/** c = mᵉ mod N avec e = 65537 = 2¹⁶ + 1 : 16 mises au carré puis une multiplication. */
function encrypt(text: string) {
  if (N === 0n) build();
  const k = Math.ceil((TITAN_A + TITAN_B) / 8);
  const t0 = performance.now();
  post({ type: "progress", step: 0, total: 17, label: "Bourrage PKCS#1 aléatoire sur " + k.toLocaleString("fr-FR") + " octets" });
  const m = bytesToBigInt(pkcs1Pad(new TextEncoder().encode(text), k));
  let c = m;
  for (let i = 1; i <= 16; i++) {
    c = (c * c) % N;
    post({ type: "progress", step: i, total: 17, label: `mise au carré ${i}/16`, elapsed: performance.now() - t0 });
  }
  c = (c * m) % N;
  post({ type: "progress", step: 17, total: 17, label: "multiplication finale par m", elapsed: performance.now() - t0 });
  const hex = c.toString(16);
  post({ type: "encrypted", ms: performance.now() - t0, hex });
}

/** Mesure le coût d'une mise au carré modulo p et q pour estimer la durée d'un déchiffrement. */
function bench() {
  if (N === 0n) build();
  const sq = (prime: bigint, bits: number) => {
    let x = prime / 3n;
    const t0 = performance.now();
    const runs = 2;
    for (let i = 0; i < runs; i++) {
      const y = x * x;
      // Réduction rapide modulo un nombre de Mersenne : x mod (2^b − 1) = (x & masque) + (x >> b)
      x = (y & prime) + (y >> BigInt(bits));
      if (x >= prime) x -= prime;
    }
    return (performance.now() - t0) / runs;
  };
  const msP = sq(p, TITAN_A);
  const msQ = sq(q, TITAN_B);
  // Déchiffrement CRT : ~A mises au carré mod p et ~B mises au carré mod q (exposants dp, dq)
  const totalMs = TITAN_A * msP + TITAN_B * msQ;
  post({ type: "bench", msP, msQ, totalMs, squaresP: TITAN_A, squaresQ: TITAN_B });
}

/** Attaque : un produit de deux nombres de Mersenne se trahit par sa forme binaire. */
function attack() {
  if (N === 0n) build();
  const t0 = performance.now();
  // N = 2^(a+b) − 2^a − 2^b + 1  ⇒  N − 1 se termine par exactement a zéros, et N a a+b bits
  const nm1 = N - 1n;
  const a = hexBitLength(nm1 & -nm1) - 1;
  const b = hexBitLength(N) - a;
  const fp = (1n << BigInt(a)) - 1n;
  const fq = (1n << BigInt(b)) - 1n;
  const ok = fp * fq === N;
  post({ type: "attacked", ok, a, b, ms: performance.now() - t0 });
}

/** Recalcule l'écriture décimale d'un des nombres et son empreinte SHA-256, pour la comparer au fichier publié. */
async function verify(which: string) {
  if (N === 0n) build();
  const value = which === "p" ? p : which === "q" ? q : N;
  const t0 = performance.now();
  const dec = value.toString(10);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dec)));
  const sha256 = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  post({ type: "verified", which, digits: dec.length, sha256, ms: performance.now() - t0 });
}

/** Test de Lucas-Lehmer : M = 2^k − 1 (k premier impair) est premier ⇔ s(k−2) ≡ 0 mod M, avec s0 = 4, s(i+1) = s(i)² − 2. */
function lucasLehmer(k: number) {
  const t0 = performance.now();
  const K = BigInt(k);
  const M = (1n << K) - 1n;
  let s = 4n;
  for (let i = 0; i < k - 2; i++) {
    let y = s * s - 2n;
    if (y < 0n) y += M;
    s = (y & M) + (y >> K);
    if (s >= M) s -= M;
  }
  post({ type: "lucas", k, prime: s === 0n || s === M, ms: performance.now() - t0 });
}

self.onmessage = (e: MessageEvent<{ type: string; text?: string; which?: string; k?: number }>) => {
  if (e.data.type === "verify") {
    verify(e.data.which ?? "p").catch((err) => post({ type: "error", message: (err as Error).message }));
    return;
  }
  if (e.data.type === "lucas") {
    lucasLehmer(e.data.k ?? 127);
    return;
  }
  try {
    if (e.data.type === "build") build();
    else if (e.data.type === "encrypt") encrypt(e.data.text ?? "");
    else if (e.data.type === "bench") bench();
    else if (e.data.type === "attack") attack();
    else if (e.data.type === "hex") {
      if (N === 0n) build();
      post({ type: "hex", hex: N.toString(16) });
    }
  } catch (err) {
    post({ type: "error", message: (err as Error).message });
  }
};
