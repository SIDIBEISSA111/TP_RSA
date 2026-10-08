// Génère l'écriture décimale complète des deux premiers de Mersenne du mode Titan et de leur produit.
// Usage : node scripts/gen-primes.mjs   (écrit dans public/primes/)
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const A = 6972593n, B = 13466917n;
const p = (1n << A) - 1n, q = (1n << B) - 1n;
const out = {};
for (const [name, value] of [["p", p], ["q", q], ["n", p * q]]) {
  const t0 = performance.now();
  const dec = value.toString(10);
  writeFileSync(`public/primes/${name}.txt`, dec);
  out[name] = { digits: dec.length, sha256: createHash("sha256").update(dec).digest("hex"), head: dec.slice(0, 50), tail: dec.slice(-50) };
  console.log(name, dec.length, "chiffres", ((performance.now() - t0) / 1000).toFixed(1) + " s");
}
writeFileSync("public/primes/manifest.json", JSON.stringify(out, null, 2));
