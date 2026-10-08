import { requireSession, route } from "@/lib/server/http";
import { me } from "@/lib/server/service";

export const GET = route(async (_req, d) => me(d, (await requireSession()).uid));
