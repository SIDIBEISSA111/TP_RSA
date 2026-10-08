// Accès base de données.
// - En production : PostgreSQL (variable DATABASE_URL, fournie par l'intégration Vercel).
// - En local et dans les tests : PGlite, un vrai PostgreSQL embarqué, sans installation.

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  kdf_salt        TEXT NOT NULL,
  auth_salt       TEXT NOT NULL,
  auth_hash       TEXT NOT NULL,
  public_key      JSONB NOT NULL,
  fingerprint     TEXT NOT NULL,
  enc_private_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id            SERIAL PRIMARY KEY,
  sender_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  env_recipient JSONB NOT NULL,
  env_sender    JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_sender ON messages (sender_id, id);
CREATE INDEX IF NOT EXISTS messages_recipient ON messages (recipient_id, id);
-- Réparation : les premières versions stockaient le JSON doublement encodé (une chaîne au lieu d'un objet)
UPDATE users SET public_key = (public_key #>> '{}')::jsonb WHERE jsonb_typeof(public_key) = 'string';
UPDATE messages SET env_recipient = (env_recipient #>> '{}')::jsonb WHERE jsonb_typeof(env_recipient) = 'string';
UPDATE messages SET env_sender = (env_sender #>> '{}')::jsonb WHERE jsonb_typeof(env_sender) = 'string';
`;
// Toujours insérer du JSON avec « $n::text::jsonb » : avec « $n::jsonb », le pilote postgres.js
// ré-encode la chaîne déjà sérialisée et la base stocke une chaîne au lieu d'un objet.

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const local = /localhost|127\.0\.0\.1/.test(url);
    const sql = postgres(url, { ssl: local ? false : "require", max: 3, idle_timeout: 20, prepare: false });
    return {
      query: async (text, params = []) => (await sql.unsafe(text, params as never[])) as never,
      exec: async (text) => {
        await sql.unsafe(text);
      },
    };
  }
  if (process.env.VERCEL) throw new Error("Base de données non configurée (DATABASE_URL manquant)");
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(process.env.PGLITE_DIR ?? "./.pglite");
  return {
    query: async (text, params = []) => (await pg.query(text, params)).rows as never,
    exec: async (text) => {
      await pg.exec(text);
    },
  };
}

const globalForDb = globalThis as unknown as { __cipherlabDb?: Promise<Db> };

export function db(): Promise<Db> {
  globalForDb.__cipherlabDb ??= connect().then(async (d) => {
    try {
      await d.exec(SCHEMA);
    } catch {
      // deux instances qui créent le schéma en même temps : la seconde réessaie une fois
      await d.exec(SCHEMA);
    }
    return d;
  });
  globalForDb.__cipherlabDb.catch(() => {
    globalForDb.__cipherlabDb = undefined;
  });
  return globalForDb.__cipherlabDb;
}
