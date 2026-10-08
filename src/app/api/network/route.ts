import { requireSession, route } from "@/lib/server/http";
import { network } from "@/lib/server/service";

// Tous les messages chiffrés du réseau, visibles par tous les utilisateurs connectés
export const GET = route(async (req, d) => {
  const s = await requireSession();
  return network(d, s.uid, Number(new URL(req.url).searchParams.get("after")) || 0);
});
