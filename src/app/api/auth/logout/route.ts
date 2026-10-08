import { closeSession, route } from "@/lib/server/http";

export const POST = route(async () => {
  await closeSession();
});
