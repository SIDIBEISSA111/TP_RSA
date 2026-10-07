import { describe, expect, it } from "vitest";
import { isProbablePrime, modInverse, modPow } from "./math";
import { buildKeyFromPrimes, decrypt, encrypt, generateKeyPair } from "./rsa";
import { fingerprint, getScheme, rsaPrivateRecord, rsaPublicRecord, type Envelope } from "./registry";
import { armor, unarmor } from "../armor";

describe("math", () => {
  it("modPow et modInverse", () => {
    expect(modPow(4n, 13n, 497n)).toBe(445n);
    expect(modInverse(17n, 3120n)).toBe(2753n);
  });

  it("Miller-Rabin", () => {
    expect(isProbablePrime(2147483647n)).toBe(true);
    expect(isProbablePrime(561n)).toBe(false); // nombre de Carmichael
    expect(isProbablePrime((1n << 127n) - 1n)).toBe(true);
    expect(isProbablePrime((1n << 128n) + 1n)).toBe(false);
  });
});

describe("RSA", () => {
  it("exemple du cours : p = 61, q = 53, e = 17", () => {
    const { key } = buildKeyFromPrimes(61n, 53n, 17n);
    expect(key.n).toBe(3233n);
    expect(key.d).toBe(2753n);
    const enc = encrypt("Salut é!", key);
    expect(enc.mode).toBe("textbook");
    expect(decrypt(enc.mode, enc.blocks, key).text).toBe("Salut é!");
  });

  it("refuse un e non premier avec φ(n)", () => {
    expect(() => buildKeyFromPrimes(61n, 53n, 7n)).not.toThrow();
    expect(() => buildKeyFromPrimes(61n, 53n, 3n)).toThrow(/pgcd/);
    expect(() => buildKeyFromPrimes(60n, 53n, 17n)).toThrow(/premier/);
  });

  it("clé 1024 bits, message long multi-blocs (PKCS#1)", () => {
    const key = generateKeyPair(1024);
    const msg = "Message secret 🔐 ".repeat(40);
    const enc = encrypt(msg, key);
    expect(enc.mode).toBe("pkcs1");
    expect(enc.blocks.length).toBeGreaterThan(1);
    expect(decrypt(enc.mode, enc.blocks, key).text).toBe(msg);
  });

  it("aller-retour via registre + format texte", async () => {
    const key = generateKeyPair(512);
    const scheme = getScheme("RSA");
    const pub = rsaPublicRecord(key);
    const r = scheme.encrypt("RDV 18h", pub);
    const env: Envelope = { v: 1, alg: "RSA", kid: await fingerprint("RSA", pub), mode: r.mode, blocks: r.blocks };
    const back = unarmor(armor("MESSAGE", "RSA", env));
    expect(back.kind).toBe("MESSAGE");
    expect(scheme.decrypt(back.payload as Envelope, rsaPrivateRecord(key)).text).toBe("RDV 18h");
  });

  it("mauvaise clé : erreur explicite", () => {
    const a = generateKeyPair(512);
    const b = generateKeyPair(512);
    const enc = encrypt("x", a);
    expect(() => decrypt(enc.mode, enc.blocks, b)).toThrow();
  });
});
