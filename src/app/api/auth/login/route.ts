import { openSession, readJson, route } from "@/lib/server/http";
import { login, me } from "@/lib/server/service";

export const POST = route(async (req, d) => {
  const body = await readJson(req, 2_000);
  const user = await login(d, body.username, body.authKey);
  await openSession(user.id, user.username);
  return me(d, user.id);
});
