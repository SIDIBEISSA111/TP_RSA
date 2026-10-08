// Logique métier du chat, indépendante de Next.js (testable directement).
// Le serveur ne stocke que : le pseudo, un hash de la clé d'authentification, la clé publique,
// la clé privée CHIFFRÉE par le mot de passe, et des messages CHIFFRÉS en RSA. Il ne peut rien lire.

import type { Db } from "./db";
import { fakeKdfSalt, hashAuthKey, randomHex, rsaFingerprint, verifyAuthKey } from "./security";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const USERNAME = /^[a-z0-9_.-]{3,20}$/;
const HEX = /^[0-9a-f]+$/;

export function normalizeUsername(raw: unknown): string {
  const u = String(raw ?? "").trim().toLowerCase();
  if (!USERNAME.test(u)) throw new ApiError(400, "Pseudo invalide : 3 à 20 caractères parmi a-z, 0-9, _ . -");
  return u;
}

function hexField(v: unknown, name: string, maxLen: number): string {
  if (typeof v !== "string" || !HEX.test(v) || v.length > maxLen || (v.length > 1 && v[0] === "0"))
    throw new ApiError(400, `Champ ${name} invalide`);
  return v;
}

export interface PublicUser {
  username: string;
  fingerprint: string;
  publicKey: { n: string; e: string };
}

interface UserRow {
  id: number;
  username: string;
  kdf_salt: string;
  auth_salt: string;
  auth_hash: string;
  public_key: { n: string; e: string };
  fingerprint: string;
  enc_private_key: string;
}

const toPublic = (u: UserRow): PublicUser => ({ username: u.username, fingerprint: u.fingerprint, publicKey: u.public_key });

export interface RegisterInput {
  username: unknown;
  kdfSalt: unknown;
  authKey: unknown;
  publicKey: unknown;
  encPrivateKey: unknown;
}

export async function register(d: Db, input: RegisterInput) {
  const username = normalizeUsername(input.username);
  const kdfSalt = hexField(input.kdfSalt, "kdfSalt", 64);
  const authKey = hexField(input.authKey, "authKey", 128);
  const pk = input.publicKey as { n?: unknown; e?: unknown } | null;
  const n = hexField(pk?.n, "n", 1024); // jusqu'à 4096 bits
  const e = hexField(pk?.e, "e", 16);
  if (n.length < 256) throw new ApiError(400, "Clé RSA trop petite : 1024 bits minimum");
  if (typeof input.encPrivateKey !== "string" || input.encPrivateKey.length > 20000 || !input.encPrivateKey.includes("."))
    throw new ApiError(400, "Clé privée chiffrée invalide");

  const authSalt = randomHex(16);
  const authHash = await hashAuthKey(authKey, authSalt);
  const rows = await d.query<UserRow>(
    `INSERT INTO users (username, kdf_salt, auth_salt, auth_hash, public_key, fingerprint, enc_private_key)
     VALUES ($1, $2, $3, $4, $5::text::jsonb, $6, $7)
     ON CONFLICT (username) DO NOTHING
     RETURNING *`,
    [username, kdfSalt, authSalt, authHash, JSON.stringify({ n, e }), rsaFingerprint(n, e), input.encPrivateKey],
  );
  if (!rows[0]) throw new ApiError(409, "Ce pseudo est déjà pris");
  return { id: rows[0].id, ...toPublic(rows[0]) };
}

export async function authParams(d: Db, rawUsername: unknown) {
  const username = normalizeUsername(rawUsername);
  const rows = await d.query<{ kdf_salt: string }>(`SELECT kdf_salt FROM users WHERE username = $1`, [username]);
  return { kdfSalt: rows[0]?.kdf_salt ?? fakeKdfSalt(username) };
}

export async function login(d: Db, rawUsername: unknown, rawAuthKey: unknown) {
  const username = normalizeUsername(rawUsername);
  const authKey = hexField(rawAuthKey, "authKey", 128);
  const rows = await d.query<UserRow>(`SELECT * FROM users WHERE username = $1`, [username]);
  const u = rows[0];
  // On calcule le hash même si le compte n'existe pas, pour ne pas le révéler par le temps de réponse
  const ok = u ? await verifyAuthKey(authKey, u.auth_salt, u.auth_hash) : (await hashAuthKey(authKey, "x"), false);
  if (!u || !ok) throw new ApiError(401, "Pseudo ou mot de passe incorrect");
  return { id: u.id, ...toPublic(u) };
}

export async function me(d: Db, uid: number) {
  const rows = await d.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [uid]);
  const u = rows[0];
  if (!u) throw new ApiError(401, "Session expirée");
  return { ...toPublic(u), kdfSalt: u.kdf_salt, encPrivateKey: u.enc_private_key };
}

export async function findUser(d: Db, rawUsername: unknown): Promise<PublicUser & { id: number }> {
  const username = normalizeUsername(rawUsername);
  const rows = await d.query<UserRow>(`SELECT * FROM users WHERE username = $1`, [username]);
  if (!rows[0]) throw new ApiError(404, `Aucun utilisateur « ${username} »`);
  return { id: rows[0].id, ...toPublic(rows[0]) };
}

/** Annuaire public : la clé publique de chaque utilisateur, visible par tous. */
export async function directory(d: Db): Promise<(PublicUser & { publishedAt: string })[]> {
  const rows = await d.query<UserRow & { created_at: Date }>(
    `SELECT username, fingerprint, public_key, created_at FROM users ORDER BY id DESC LIMIT 500`,
  );
  return rows.map((u) => ({ ...toPublic(u), publishedAt: new Date(u.created_at).toISOString() }));
}

interface Envelope {
  v: 1;
  alg: string;
  kid: string;
  mode: string;
  blocks: string[];
}

export interface NetworkMessage {
  id: number;
  from: string;
  to: string;
  createdAt: string;
  /** Chiffré avec la clé publique du destinataire : tout le monde le voit, seul le destinataire peut l'ouvrir */
  env: Envelope;
  /** Copie chiffrée avec la clé publique de l'expéditeur : renvoyée uniquement à l'expéditeur */
  senderEnv?: Envelope;
}

/** Le réseau : TOUS les messages chiffrés, diffusés à tous les utilisateurs connectés. */
export async function network(d: Db, uid: number, after: number): Promise<NetworkMessage[]> {
  const initial = !after;
  const rows = await d.query<{
    id: number;
    sender_id: number;
    sender: string;
    recipient: string;
    created_at: Date;
    env_recipient: Envelope;
    env_sender: Envelope;
  }>(
    `SELECT m.id, m.sender_id, s.username AS sender, r.username AS recipient, m.created_at, m.env_recipient, m.env_sender
     FROM messages m
     JOIN users s ON s.id = m.sender_id
     JOIN users r ON r.id = m.recipient_id
     WHERE m.id > $1
     ORDER BY m.id ${initial ? "DESC" : "ASC"}
     LIMIT 200`,
    [after || 0],
  );
  if (initial) rows.reverse();
  return rows.map((r) => ({
    id: r.id,
    from: r.sender,
    to: r.recipient,
    createdAt: new Date(r.created_at).toISOString(),
    env: r.env_recipient,
    ...(r.sender_id === uid ? { senderEnv: r.env_sender } : {}),
  }));
}

function checkEnvelope(v: unknown, expectedKid: string, who: string): Envelope {
  const env = v as Envelope;
  const ok =
    env &&
    env.v === 1 &&
    env.alg === "RSA" &&
    env.mode === "pkcs1" &&
    Array.isArray(env.blocks) &&
    env.blocks.length > 0 &&
    env.blocks.length <= 40 &&
    env.blocks.every((b) => typeof b === "string" && HEX.test(b) && b.length <= 1100);
  if (!ok) throw new ApiError(400, `Message chiffré invalide (${who})`);
  if (env.kid !== expectedKid) throw new ApiError(400, `Le message n'est pas chiffré avec la clé publique actuelle (${who})`);
  return { v: 1, alg: env.alg, kid: env.kid, mode: env.mode, blocks: env.blocks };
}

export async function sendMessage(d: Db, uid: number, toName: unknown, envRecipient: unknown, envSender: unknown) {
  const to = await findUser(d, toName);
  if (to.id === uid) throw new ApiError(400, "Tu ne peux pas t'écrire à toi-même");
  const [sender] = await d.query<{ fingerprint: string }>(`SELECT fingerprint FROM users WHERE id = $1`, [uid]);
  if (!sender) throw new ApiError(401, "Session expirée");
  const er = checkEnvelope(envRecipient, to.fingerprint, "destinataire");
  const es = checkEnvelope(envSender, sender.fingerprint, "copie expéditeur");

  const [{ count }] = await d.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM messages WHERE sender_id = $1 AND created_at > now() - interval '1 minute'`,
    [uid],
  );
  if (count >= 30) throw new ApiError(429, "Trop de messages : attends une minute");

  const [row] = await d.query<{ id: number; created_at: Date }>(
    `INSERT INTO messages (sender_id, recipient_id, env_recipient, env_sender) VALUES ($1, $2, $3::text::jsonb, $4::text::jsonb)
     RETURNING id, created_at`,
    [uid, to.id, JSON.stringify(er), JSON.stringify(es)],
  );
  return { id: row.id, createdAt: new Date(row.created_at).toISOString() };
}
