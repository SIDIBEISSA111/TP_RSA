import { readJson, requireSession, route } from "@/lib/server/http";
import { listMessages, sendMessage } from "@/lib/server/service";

export const GET = route(async (req, d) => {
  const s = await requireSession();
  const params = new URL(req.url).searchParams;
  return listMessages(d, s.uid, params.get("with"), Number(params.get("after")) || 0);
});

export const POST = route(async (req, d) => {
  const s = await requireSession();
  const body = await readJson(req);
  return sendMessage(d, s.uid, body.to, body.envRecipient, body.envSender);
});
