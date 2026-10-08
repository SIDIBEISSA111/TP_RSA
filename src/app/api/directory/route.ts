import { requireSession, route } from "@/lib/server/http";
import { directory } from "@/lib/server/service";

// Annuaire des clés publiques publiées sur le réseau
export const GET = route(async (_req, d) => {
  await requireSession();
  return directory(d);
});
