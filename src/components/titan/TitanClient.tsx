"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Button, Label, Panel, downloadText, inputClass } from "@/components/ui";
import { LucasLehmer, PrimeViewer, type Verified, type Which } from "./PrimeViewer";

// Onglet actif dans l'URL (#nombres) : lien direct possible vers les nombres premiers
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const useHash = () => useSyncExternalStore(subscribeHash, () => location.hash, () => "");

interface Part {
  digits: number;
  head: string;
  tail: string;
}

interface Built {
  mulMs: number;
  p: Part;
  q: Part;
  n: Part & { bits: number; hexHead: string; hexTail: string; hexLength: number };
}

interface Bench {
  msP: number;
  msQ: number;
  totalMs: number;
  squaresP: number;
  squaresQ: number;
}

const fr = (n: number) => n.toLocaleString("fr-FR");

function duration(ms: number) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} heures`;
  if (s < 86400 * 365) return `${fr(Math.round(s / 86400))} jours`;
  return `${(s / 86400 / 365).toFixed(1)} ans`;
}

export function TitanClient() {
  const worker = useRef<Worker | null>(null);
  const [built, setBuilt] = useState<Built | null>(null);
  const [building, setBuilding] = useState(false);
  const [text, setText] = useState("Le cours de crypto, niveau TITAN.");
  const [progress, setProgress] = useState<{ step: number; total: number; label: string; elapsed?: number } | null>(null);
  const [cipher, setCipher] = useState<{ ms: number; hex: string } | null>(null);
  const [bench, setBench] = useState<Bench | null>(null);
  const [benching, setBenching] = useState(false);
  const [attack, setAttack] = useState<{ ok: boolean; a: number; b: number; ms: number } | null>(null);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState<Partial<Record<Which, Verified>>>({});
  const [verifying, setVerifying] = useState<Which | null>(null);
  const [lucas, setLucas] = useState<{ k: number; prime: boolean; ms: number } | null>(null);
  const [lucasRunning, setLucasRunning] = useState(false);
  const tab = useHash() === "#nombres" ? "nombres" : "defi";

  useEffect(() => {
    const w = new Worker(new URL("../../workers/titan.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e) => {
      const m = e.data;
      switch (m.type) {
        case "built":
          setBuilt(m);
          setBuilding(false);
          break;
        case "progress":
          setProgress(m);
          break;
        case "encrypted":
          setCipher({ ms: m.ms, hex: m.hex });
          setProgress(null);
          break;
        case "bench":
          setBench(m);
          setBenching(false);
          break;
        case "attacked":
          setAttack(m);
          break;
        case "hex":
          downloadText("titan-n.hex.txt", m.hex);
          break;
        case "verified":
          setVerified((prev) => ({ ...prev, [m.which]: m }));
          setVerifying(null);
          break;
        case "lucas":
          setLucas(m);
          setLucasRunning(false);
          break;
        case "error":
          setVerifying(null);
          setLucasRunning(false);
          setError(m.message);
          setBuilding(false);
          setBenching(false);
          setProgress(null);
          break;
      }
    };
    return () => w.terminate();
  }, []);

  const send = (msg: object) => worker.current?.postMessage(msg);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-xs tracking-[0.3em] text-amber">{"// DÉFI TITAN"}</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
          RSA avec des premiers de <span className="text-amber">plus d&apos;un million</span> de chiffres
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-mute">
          Trouver au hasard un nombre premier d&apos;un million de chiffres prendrait des années de calcul. On utilise
          donc deux premiers déjà connus, découverts par le projet GIMPS : des <b className="text-ink">nombres de Mersenne</b>{" "}
          de la forme 2ᵏ − 1. Ils se reconstruisent instantanément à partir de leur seul exposant.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-1.5" role="tablist">
        {(
          [
            ["defi", "#", "⚡ Le défi"],
            ["nombres", "#nombres", "🔢 Voir les nombres premiers"],
          ] as const
        ).map(([id, href, label]) => (
          <a
            key={id}
            href={href}
            role="tab"
            aria-selected={tab === id}
            className={`rounded-t border-b-2 px-3 py-2.5 text-xs transition sm:text-sm ${
              tab === id ? "border-amber bg-amber/10 text-amber" : "border-line text-mute hover:text-ink"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <div hidden={tab !== "nombres"} className="space-y-6">
        <Panel title="titan/nombres.txt">
          <PrimeViewer
            verified={verified}
            verifying={verifying}
            onVerify={(w) => {
              setVerifying(w);
              send({ type: "verify", which: w });
            }}
          />
        </Panel>
        <Panel title="titan/lucas-lehmer.sh">
          <LucasLehmer
            result={lucas}
            running={lucasRunning}
            onRun={(k) => {
              setLucasRunning(true);
              send({ type: "lucas", k });
            }}
          />
        </Panel>
      </div>

      <div hidden={tab !== "defi"} className="space-y-6">

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <PrimeCard name="p" formula="2^6 972 593 − 1" year="1999" part={built?.p} fallbackDigits={2098960} />
        <PrimeCard name="q" formula="2^13 466 917 − 1" year="2001" part={built?.q} fallbackDigits={4053946} />
      </div>

      <Panel title="titan/01-produit.sh">
        <p className="mb-4 text-sm text-mute">Étape 1 : la clé publique n = p × q.</p>
        {!built ? (
          <Button
            variant="primary"
            disabled={building}
            onClick={() => {
              setBuilding(true);
              send({ type: "build" });
            }}
          >
            {building ? "Multiplication en cours…" : "✕ Calculer n = p × q"}
          </Button>
        ) : (
          <div className="rise space-y-4">
            <div className="grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
              <Stat value={fr(built.n.digits)} label="chiffres décimaux dans n" accent />
              <Stat value={fr(built.n.bits)} label="bits" />
              <Stat value={`${fr(Math.round(built.mulMs))} ms`} label="temps de la multiplication" />
            </div>
            <div>
              <Label>n en décimal (début … fin)</Label>
              <div className="rounded border border-line bg-void p-3 text-xs break-all text-neon">
                {built.n.head}
                <span className="text-mute"> …[{fr(built.n.digits - 8 - 24)} chiffres]… </span>
                {built.n.tail}
              </div>
            </div>
            <div>
              <Label>n en hexadécimal (début … fin)</Label>
              <div className="rounded border border-line bg-void p-3 text-[11px] break-all text-cyan">
                {built.n.hexHead}
                <span className="text-mute"> …[{fr(built.n.hexLength - 192)} symboles]… </span>
                {built.n.hexTail}
              </div>
            </div>
            <Button onClick={() => send({ type: "hex" })}>⤓ Télécharger n complet ({fr(Math.round(built.n.hexLength / 1e6 * 10) / 10)} Mo)</Button>
          </div>
        )}
      </Panel>

      <Panel title="titan/02-chiffrer.sh">
        <p className="mb-4 text-sm text-mute">
          Étape 2 : chiffrer un message avec la clé publique (n, e = 65537). Le message est d&apos;abord bourré avec des
          octets aléatoires jusqu&apos;à la taille de n (≈ 2,5 Mo), puis élevé à la puissance 65537 modulo n : 16
          mises au carré et une multiplication, chacune sur des nombres de 20 millions de bits.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Message</Label>
            <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
          </div>
          <Alert kind="warn">Compte 1 à 3 minutes sur un ordinateur, davantage sur téléphone. La page reste utilisable.</Alert>
          <Button
            variant="primary"
            disabled={!!progress || !text}
            onClick={() => {
              setCipher(null);
              setProgress({ step: 0, total: 17, label: "démarrage" });
              send({ type: "encrypt", text });
            }}
          >
            🔒 Chiffrer avec la clé TITAN
          </Button>
          {progress && (
            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded bg-line">
                <div
                  className="h-full bg-amber shadow-[0_0_12px_var(--color-amber)] transition-all duration-500"
                  style={{ width: `${(progress.step / progress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-mute">
                <span className="cursor">{progress.label}</span>
                {progress.elapsed !== undefined && <span>{duration(progress.elapsed)}</span>}
              </div>
            </div>
          )}
          {cipher && (
            <div className="rise space-y-2">
              <p className="text-xs text-neon">✓ Chiffré en {duration(cipher.ms)}. Le message chiffré fait {fr(cipher.hex.length)} symboles hexadécimaux :</p>
              <div className="rounded border border-line bg-void p-3 text-[11px] break-all text-amber">
                {cipher.hex.slice(0, 120)}
                <span className="text-mute"> … </span>
                {cipher.hex.slice(-120)}
              </div>
              <Button onClick={() => downloadText("titan-message.hex.txt", cipher.hex)}>⤓ Télécharger le chiffré</Button>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="titan/03-dechiffrer.sh">
        <p className="mb-4 text-sm text-mute">
          Étape 3 : le destinataire connaît p et q. Pour déchiffrer, il doit calculer cᵈ mod n, où l&apos;exposant
          privé d fait lui aussi des millions de bits. Même avec l&apos;accélération par les restes chinois, il faut
          environ <b className="text-ink">20 millions de mises au carré</b> de nombres géants. Mesurons-le sur ta
          machine :
        </p>
        <Button
          variant="primary"
          disabled={benching}
          onClick={() => {
            setBenching(true);
            send({ type: "bench" });
          }}
        >
          {benching ? "Mesure en cours…" : "⏱ Estimer le temps de déchiffrement"}
        </Button>
        {bench && (
          <div className="rise mt-4 space-y-3">
            <div className="grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
              <Stat value={`${bench.msP.toFixed(0)} ms`} label="une mise au carré mod p" />
              <Stat value={`${bench.msQ.toFixed(0)} ms`} label="une mise au carré mod q" />
              <Stat value={duration(bench.totalMs)} label="déchiffrement estimé" accent />
            </div>
            <Alert kind="info">
              {fr(bench.squaresP)} × {bench.msP.toFixed(0)} ms + {fr(bench.squaresQ)} × {bench.msQ.toFixed(0)} ms ≈{" "}
              {duration(bench.totalMs)}. Le chiffrement est rapide parce que e = 65537 est petit ; le déchiffrement
              est lent parce que d est énorme. C&apos;est pour cela que les vraies clés RSA font 2048 à 4096 bits, et non
              des millions de chiffres : la sécurité est déjà largement suffisante, et le déchiffrement prend quelques
              millisecondes. Teste le cycle complet dans le labo.
            </Alert>
          </div>
        )}
      </Panel>

      <Panel title="titan/04-attaque.sh" className="border-danger/40">
        <p className="mb-4 text-sm text-mute">
          Bonus hacking : une clé géante n&apos;est pas forcément une clé sûre. Comme p et q sont des nombres de
          Mersenne publics, n a une forme binaire très reconnaissable : n = 2ᵃ⁺ᵇ − 2ᵃ − 2ᵇ + 1. Un attaquant peut
          retrouver p et q en une fraction de seconde.
        </p>
        <Button variant="danger" onClick={() => send({ type: "attack" })}>
          ☠ Factoriser n
        </Button>
        {attack && (
          <div className="rise mt-4 rounded border border-danger/40 bg-danger/5 p-3 text-xs leading-relaxed">
            <div className="text-danger">[!] n factorisé en {attack.ms.toFixed(0)} ms</div>
            <div className="text-mute">
              n − 1 se termine par {fr(attack.a)} zéros binaires ⇒ p = 2^{fr(attack.a)} − 1
            </div>
            <div className="text-mute">
              n a {fr(attack.a + attack.b)} bits ⇒ q = 2^{fr(attack.b)} − 1
            </div>
            <div className={attack.ok ? "text-neon" : "text-danger"}>
              {attack.ok ? "[+] Vérifié : p × q = n. La clé privée est compromise." : "[!] Vérification échouée"}
            </div>
            <div className="mt-2 text-amber">
              Leçon : les premiers d&apos;une clé RSA doivent être secrets et tirés au hasard, comme dans le labo.
            </div>
          </div>
        )}
      </Panel>
      </div>
    </div>
  );
}

function PrimeCard({
  name,
  formula,
  year,
  part,
  fallbackDigits,
}: {
  name: string;
  formula: string;
  year: string;
  part?: Part;
  fallbackDigits: number;
}) {
  return (
    <div className="rounded-lg border border-amber/30 bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-3xl font-bold text-amber">{name}</span>
        <span className="text-[11px] text-mute">découvert en {year}</span>
      </div>
      <div className="mt-2 text-lg text-ink">{formula}</div>
      <div className="mt-1 text-sm text-neon">{fr(part?.digits ?? fallbackDigits)} chiffres</div>
      {part && (
        <div className="mt-3 rounded bg-void p-2 text-[11px] break-all text-mute">
          {part.head}…{part.tail}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="bg-void px-4 py-3">
      <div className={`font-display text-xl font-bold ${accent ? "text-amber" : "text-ink"}`}>{value}</div>
      <div className="text-[11px] text-mute">{label}</div>
    </div>
  );
}
