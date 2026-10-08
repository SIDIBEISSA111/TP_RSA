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

describe("messages chiffrés", () => {
  it("Awa écrit à Moussa, chacun relit avec SA clé privée", async () => {
    const text = "RDV 18h à la BU 🔐";
    await svc.sendMessage(d, awa.id, "moussa", await envFor(text, moussa.pub), await envFor(text, awa.pub));

    const forMoussa = await svc.listMessages(d, moussa.id, "awa", 0);
    expect(forMoussa).toHaveLength(1);
    expect(forMoussa[0].fromMe).toBe(false);
    expect(getScheme("RSA").decrypt(forMoussa[0].env, moussa.priv).text).toBe(text);
    // La clé d'Awa ne peut pas ouvrir l'exemplaire de Moussa
    expect(() => getScheme("RSA").decrypt(forMoussa[0].env, awa.priv)).toThrow();

    const forAwa = await svc.listMessages(d, awa.id, "moussa", 0);
    expect(forAwa[0].fromMe).toBe(true);
    expect(getScheme("RSA").decrypt(forAwa[0].env, awa.priv).text).toBe(text);
  });

  it("réponse + pagination par id + liste des conversations", async () => {
    const [first] = await svc.listMessages(d, moussa.id, "awa", 0);
    await svc.sendMessage(d, moussa.id, "awa", await envFor("Ok !", awa.pub), await envFor("Ok !", moussa.pub));
    const newer = await svc.listMessages(d, awa.id, "moussa", first.id);
    expect(newer).toHaveLength(1);
    expect(getScheme("RSA").decrypt(newer[0].env, awa.priv).text).toBe("Ok !");

    const convs = await svc.conversations(d, awa.id);
    expect(convs).toHaveLength(1);
    expect(convs[0]).toMatchObject({ username: "moussa", lastFromMe: false });
  });

  it("refuse un message chiffré avec une autre clé que celle du destinataire", async () => {
    await expect(
      svc.sendMessage(d, awa.id, "moussa", await envFor("x", awa.pub), await envFor("x", awa.pub)),
    ).rejects.toThrow(/clé publique actuelle/);
  });

  it("un tiers ne voit pas la conversation", async () => {
    const eve = await makeUser("eve");
    expect(await svc.conversations(d, eve.id)).toHaveLength(0);
    const leak = await svc.listMessages(d, eve.id, "awa", 0);
    expect(leak).toHaveLength(0);
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
