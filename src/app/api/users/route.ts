import { requireSession, route } from "@/lib/server/http";
import { findUser, searchUsers } from "@/lib/server/service";

// ?q=ab → recherche par début de pseudo ; ?username=abc → un utilisateur précis, avec sa clé publique
export const GET = route(async (req, d) => {
  const s = await requireSession();
  const params = new URL(req.url).searchParams;
  const exact = params.get("username");
  if (exact) {
    const { username, fingerprint, publicKey } = await findUser(d, exact);
    return { username, fingerprint, publicKey };
  }
  return searchUsers(d, s.uid, params.get("q") ?? "");
});
