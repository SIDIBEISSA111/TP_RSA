import { generateKeyPair } from "@/lib/crypto/rsa";
import { rsaPrivateRecord } from "@/lib/crypto/registry";

self.onmessage = (e: MessageEvent<{ bits: number }>) => {
  const t0 = performance.now();
  try {
    const key = generateKeyPair(e.data.bits, (line) => self.postMessage({ type: "log", line }));
    self.postMessage({ type: "done", record: rsaPrivateRecord(key), ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ type: "error", message: (err as Error).message });
  }
};
