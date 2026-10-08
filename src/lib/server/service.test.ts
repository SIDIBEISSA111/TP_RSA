import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { generateKeyPair } from "../crypto/rsa";
import { fingerprint, getScheme, rsaPrivateRecord, rsaPublicRecord, type Envelope, type KeyRecord } from "../crypto/registry";
import type { Db } from "./db";

// Les tests passent par le même pilote qu'en production (postgres.js), branché sur un PostgreSQL embarqué
const PORT = 5433 + Math.floor(Math.random() * 1000);
let server: PGLiteSocketServer;

let d: Db;
let svc: typeof import("./service");

interface TestUser {
  id: number;
  name: string;
  pub: KeyRecord;
  priv: KeyRecord;
  fp: string;
}

async function makeUser(name: string): Promise<TestUser> {
  const key = generateKeyPair(1024);
  const pub = rsaPublicRecord(key);
  const u = await svc.register(d, {
    username: name,
    kdfSalt: "ab".repeat(16),
    authKey: "cd".repeat(32) + name.length.toString(16),
    publicKey: pub,
    encPrivateKey: "iv.ct",
  });
  return { id: u.id, name, pub, priv: rsaPrivateRecord(key), fp: u.fingerprint };
}

async function envFor(text: string, pub: KeyRecord): Promise<Envelope> {
  const r = getScheme("RSA").encrypt(text, pub);
  return { v: 1, alg: "RSA", kid: await fingerprint("RSA", pub), mode: r.mode, blocks: r.blocks };
}

let awa: TestUser;
let moussa: TestUser;

beforeAll(async () => {
  server = new PGLiteSocketServer({ db: new PGlite("memory://"), port: PORT });
  await server.start();
  process.env.DATABASE_URL = `postgres://postgres@127.0.0.1:${PORT}/postgres`;
  d = await (await import("./db")).db();
  svc = await import("./service");
  awa = await makeUser("awa");
  moussa = await makeUser("moussa");
});

afterAll(async () => {
  await server.stop();
});

describe("comptes", () => {
  it("l'empreinte calculée par le serveur = celle du navigateur", async () => {
    expect(awa.fp).toBe(await fingerprint("RSA", awa.pub));
  });

  it("pseudo unique, insensible à la casse", async () => {
    await expect(makeUser("AWA")).rejects.toThrow(/déjà pris/);
  });

  it("pseudo invalide refusé", async () => {
    await expect(makeUser("a b")).rejects.toThrow(/Pseudo invalide/);
  });

  it("connexion : bonne et mauvaise clé d'authentification", async () => {
    const ok = await svc.login(d, "awa", "cd".repeat(32) + "3");
    expect(ok.username).toBe("awa");
    await expect(svc.login(d, "awa", "ef".repeat(32))).rejects.toThrow(/incorrect/);
    await expect(svc.login(d, "inconnu", "ef".repeat(32))).rejects.toThrow(/incorrect/);
  });

  it("le sel d'un compte inexistant est stable mais ne révèle rien", async () => {
    const a = await svc.authParams(d, "fantome");
    const b = await svc.authParams(d, "fantome");
    expect(a.kdfSalt).toBe(b.kdfSalt);
    expect((await svc.authParams(d, "awa")).kdfSalt).toBe("ab".repeat(16));
  });
});

describe("réseau public de messages chiffrés", () => {
  it("Awa diffuse un message pour Moussa : seul Moussa peut le déchiffrer", async () => {
    const text = "RDV 18h à la BU 🔐";
    await svc.sendMessage(d, awa.id, "moussa", await envFor(text, moussa.pub), await envFor(text, awa.pub));

    const [m] = await svc.network(d, moussa.id, 0);
    expect(m).toMatchObject({ from: "awa", to: "moussa" });
    expect(getScheme("RSA").decrypt(m.env, moussa.priv).text).toBe(text);
    // Le destinataire ne reçoit pas la copie de l'expéditeur
    expect(m.senderEnv).toBeUndefined();
  });

  it("un tiers voit le message dans le réseau mais sa clé privée ne l'ouvre pas", async () => {
    const eve = await makeUser("eve");
    const [m] = await svc.network(d, eve.id, 0);
    expect(m).toMatchObject({ from: "awa", to: "moussa" });
    expect(m.senderEnv).toBeUndefined();
    expect(() => getScheme("RSA").decrypt(m.env, eve.priv)).toThrow();
  });

  it("l'expéditeur relit sa propre copie, chiffrée avec SA clé publique", async () => {
    const [m] = await svc.network(d, awa.id, 0);
    expect(m.senderEnv).toBeDefined();
    expect(getScheme("RSA").decrypt(m.senderEnv!, awa.priv).text).toBe("RDV 18h à la BU 🔐");
    expect(() => getScheme("RSA").decrypt(m.env, awa.priv)).toThrow();
  });

  it("pagination : seuls les nouveaux messages après un id", async () => {
    const [first] = await svc.network(d, awa.id, 0);
    await svc.sendMessage(d, moussa.id, "awa", await envFor("Ok !", awa.pub), await envFor("Ok !", moussa.pub));
    const newer = await svc.network(d, awa.id, first.id);
    expect(newer).toHaveLength(1);
    expect(newer[0]).toMatchObject({ from: "moussa", to: "awa" });
    expect(getScheme("RSA").decrypt(newer[0].env, awa.priv).text).toBe("Ok !");
  });

  it("annuaire : toutes les clés publiques, sans aucune donnée secrète", async () => {
    const dir = await svc.directory(d);
    expect(dir.map((u) => u.username)).toEqual(expect.arrayContaining(["awa", "moussa", "eve"]));
    const a = dir.find((u) => u.username === "awa")!;
    expect(a.publicKey).toEqual(awa.pub);
    expect(Object.keys(a).sort()).toEqual(["fingerprint", "publicKey", "publishedAt", "username"]);
  });

  it("refuse un message chiffré avec une autre clé que celle du destinataire", async () => {
    await expect(
      svc.sendMessage(d, awa.id, "moussa", await envFor("x", awa.pub), await envFor("x", awa.pub)),
    ).rejects.toThrow(/clé publique actuelle/);
  });
});

describe("format JSON en base (régression)", () => {
  it("la clé publique est stockée comme un objet JSON, pas comme une chaîne", async () => {
    const [row] = await d.query<{ t: string }>(`SELECT jsonb_typeof(public_key) AS t FROM users WHERE username = 'awa'`);
    expect(row.t).toBe("object");
    const u = await svc.findUser(d, "awa");
    expect(u.publicKey.n).toBe(awa.pub.n);
    expect(await fingerprint("RSA", u.publicKey)).toBe(u.fingerprint);
  });

  it("le schéma répare les lignes doublement encodées des premières versions", async () => {
    await d.query(`UPDATE users SET public_key = to_jsonb(public_key::text) WHERE username = 'moussa'`);
    const [broken] = await d.query<{ t: string }>(`SELECT jsonb_typeof(public_key) AS t FROM users WHERE username = 'moussa'`);
    expect(broken.t).toBe("string");
    await d.exec((await import("./db")).SCHEMA);
    const u = await svc.findUser(d, "moussa");
    expect(await fingerprint("RSA", u.publicKey)).toBe(u.fingerprint);
  });
});
