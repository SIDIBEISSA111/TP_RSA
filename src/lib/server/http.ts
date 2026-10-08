import { unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db, type Db } from "./db";
import { SESSION_COOKIE, SESSION_TTL, signSession, verifySession, type Session } from "./security";
import { ApiError } from "./service";

type Handler = (req: Request, d: Db) => Promise<unknown>;

/** Enveloppe commune des routes API : connexion à la base, erreurs JSON homogènes. */
export function route(fn: Handler) {
  return async (req: Request) => {
    // Réponses toujours calculées à la demande : jamais de pré-rendu au build
    await connection();
    try {
      if (req.method !== "GET" && !req.headers.get("content-type")?.includes("application/json")) {
        // Un formulaire d'un autre site ne peut pas envoyer de JSON sans autorisation CORS : protection CSRF
        throw new ApiError(415, "Content-Type application/json attendu");
      }
      const data = await fn(req, await db());
      return Response.json(data ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof ApiError) return Response.json({ error: err.message }, { status: err.status });
      console.error(err);
      return Response.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request, max = 300_000): Promise<T> {
  const text = await req.text();
  if (text.length > max) throw new ApiError(413, "Requête trop volumineuse");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "JSON invalide");
  }
}

export async function requireSession(): Promise<Session> {
  const s = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) throw new ApiError(401, "Non connecté");
  return s;
}

export async function openSession(uid: number, username: string) {
  (await cookies()).set(SESSION_COOKIE, signSession({ uid, username }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function closeSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
