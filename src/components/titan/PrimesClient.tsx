"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Panel } from "@/components/ui";
import { LucasLehmer, PrimeViewer, type Verified, type Which } from "./PrimeViewer";

/** Les deux premiers d'un million de chiffres (et leur produit), avec vérification dans le navigateur. */
export function PrimesClient() {
  const worker = useRef<Worker | null>(null);
  const [verified, setVerified] = useState<Partial<Record<Which, Verified>>>({});
  const [verifying, setVerifying] = useState<Which | null>(null);
  const [lucas, setLucas] = useState<{ k: number; prime: boolean; ms: number } | null>(null);
  const [lucasRunning, setLucasRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const w = new Worker(new URL("../../workers/titan.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "verified") {
        setVerified((prev) => ({ ...prev, [m.which]: m }));
        setVerifying(null);
      } else if (m.type === "lucas") {
        setLucas(m);
        setLucasRunning(false);
      } else if (m.type === "error") {
        setError(m.message);
        setVerifying(null);
        setLucasRunning(false);
      }
    };
    return () => w.terminate();
  }, []);

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <Panel title="titan/nombres.txt">
        <PrimeViewer
          verified={verified}
          verifying={verifying}
          onVerify={(w) => {
            setVerifying(w);
            worker.current?.postMessage({ type: "verify", which: w });
          }}
        />
      </Panel>
      <Panel title="titan/lucas-lehmer.sh">
        <LucasLehmer
          result={lucas}
          running={lucasRunning}
          onRun={(k) => {
            setLucasRunning(true);
            worker.current?.postMessage({ type: "lucas", k });
          }}
        />
      </Panel>
    </div>
  );
}
