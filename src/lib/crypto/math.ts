// Arithmétique sur grands entiers (BigInt), sans dépendance externe.
// Tout ce qui est aléatoire passe par crypto.getRandomValues (CSPRNG du navigateur).

export function bitLength(n: bigint): number {
  return n === 0n ? 0 : n.toString(2).length;
}

export function byteLength(n: bigint): number {
  return Math.ceil(bitLength(n) / 8);
}

export function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

/** Exponentiation modulaire rapide (square-and-multiply). */
export function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m === 1n) return 0n;
  let result = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return result;
}

export function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}

/** Algorithme d'Euclide étendu : renvoie [g, x, y] avec a·x + b·y = g. */
export function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  let [oldR, r] = [a, b];
  let [oldS, s] = [1n, 0n];
  let [oldT, t] = [0n, 1n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return [oldR, oldS, oldT];
}

export function modInverse(a: bigint, m: bigint): bigint {
  const [g, x] = egcd(mod(a, m), m);
  if (g !== 1n) throw new Error("Pas d'inverse modulaire : les nombres ne sont pas premiers entre eux");
  return mod(x, m);
}

export function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  // getRandomValues est limité à 65 536 octets par appel
  for (let i = 0; i < len; i += 65536) {
    crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, len)));
  }
  return out;
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n;
  return BigInt("0x" + bytesToHex(bytes));
}

export function bigIntToBytes(n: bigint, length?: number): Uint8Array {
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const raw = hexToBytes(hex);
  if (length === undefined || raw.length === length) return raw;
  if (raw.length > length) throw new Error("Nombre trop grand pour la taille demandée");
  const out = new Uint8Array(length);
  out.set(raw, length - raw.length);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Entier aléatoire d'exactement `bits` bits (bit de poids fort forcé à 1). */
export function randomBits(bits: number): bigint {
  const bytes = randomBytes(Math.ceil(bits / 8));
  const extra = bytes.length * 8 - bits;
  bytes[0] &= 0xff >> extra;
  bytes[0] |= 0x80 >> extra;
  return bytesToBigInt(bytes);
}

/** Entier aléatoire uniforme dans [min, max]. */
export function randomBetween(min: bigint, max: bigint): bigint {
  const range = max - min + 1n;
  const bits = bitLength(range);
  for (;;) {
    const bytes = randomBytes(Math.ceil(bits / 8));
    bytes[0] &= 0xff >> (bytes.length * 8 - bits);
    const r = bytesToBigInt(bytes);
    if (r < range) return min + r;
  }
}

const SMALL_PRIMES: number[] = (() => {
  const limit = 20000;
  const sieve = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (!sieve[i]) {
      primes.push(i);
      for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
    }
  }
  return primes;
})();

/** Test de primalité de Miller-Rabin (probabiliste, erreur ≤ 4^-rounds). */
export function isProbablePrime(n: bigint, rounds = 40): boolean {
  if (n < 2n) return false;
  for (const sp of SMALL_PRIMES) {
    const p = BigInt(sp);
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  // Pour n < 3.3·10^24, ces bases rendent le test déterministe
  const fixed = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
  const bases = n < 3317044064679887385961981n ? fixed : Array.from({ length: rounds }, () => randomBetween(2n, n - 2n));
  outer: for (const a of bases) {
    if (a % n === 0n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

export interface PrimeProgress {
  candidates: number;
  millerRabinTests: number;
}

/** Génère un nombre premier aléatoire d'exactement `bits` bits. */
export function generatePrime(bits: number, onProgress?: (p: PrimeProgress) => void): bigint {
  if (bits < 8) throw new Error("Taille trop petite");
  const stats: PrimeProgress = { candidates: 0, millerRabinTests: 0 };
  for (;;) {
    // Deux bits de poids fort à 1 : p·q aura exactement 2·bits bits
    const candidate = randomBits(bits) | (1n << BigInt(bits - 2)) | 1n;
    // Crible incrémental : on avance de 2 en 2 depuis un point de départ aléatoire
    const residues = SMALL_PRIMES.map((p) => Number(candidate % BigInt(p)));
    for (let delta = 0; delta < 20000; delta += 2) {
      stats.candidates++;
      let divisible = false;
      for (let i = 0; i < SMALL_PRIMES.length; i++) {
        if ((residues[i] + delta) % SMALL_PRIMES[i] === 0) {
          divisible = true;
          break;
        }
      }
      if (divisible) continue;
      const c = candidate + BigInt(delta);
      if (bitLength(c) !== bits) break;
      stats.millerRabinTests++;
      onProgress?.(stats);
      if (isProbablePrime(c)) return c;
    }
  }
}
