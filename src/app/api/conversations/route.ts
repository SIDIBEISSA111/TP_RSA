import { requireSession, route } from "@/lib/server/http";
import { conversations } from "@/lib/server/service";

export const GET = route(async (_req, d) => conversations(d, (await requireSession()).uid));
