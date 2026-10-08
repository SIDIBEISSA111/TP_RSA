import { route } from "@/lib/server/http";
import { authParams } from "@/lib/server/service";

export const GET = route((req, d) => authParams(d, new URL(req.url).searchParams.get("username")));
