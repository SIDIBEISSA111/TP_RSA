import { openSession, readJson, route } from "@/lib/server/http";
import { register, type RegisterInput } from "@/lib/server/service";

export const POST = route(async (req, d) => {
  const user = await register(d, await readJson<RegisterInput>(req, 60_000));
  await openSession(user.id, user.username);
  return { username: user.username, fingerprint: user.fingerprint };
});
