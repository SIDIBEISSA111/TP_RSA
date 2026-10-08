import { readJson, requireSession, route } from "@/lib/server/http";
import { sendMessage } from "@/lib/server/service";

// Diffuse un message chiffré sur le réseau
export const POST = route(async (req, d) => {
  const s = await requireSession();
  const body = await readJson(req);
  return sendMessage(d, s.uid, body.to, body.envRecipient, body.envSender);
});
