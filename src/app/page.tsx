import Link from "next/link";
import { BootSequence } from "@/components/BootSequence";
import { MatrixRain } from "@/components/MatrixRain";
import { SCHEMES } from "@/lib/crypto/registry";

const STEPS = [
  {
    n: "01",
    title: "Génère tes clés",
    text: "Deux grands nombres premiers p et q sont tirés au hasard dans ton navigateur. Ils donnent ta clé publique (n, e) et ta clé privée d.",
  },
  {
    n: "02",
    title: "Partage ta clé publique",
    text: "Envoie-la à qui tu veux : elle sert uniquement à chiffrer des messages pour toi. Ta clé privée ne quitte jamais ton appareil.",
  },
  {
    n: "03",
    title: "Échange des secrets",
    text: "Ton correspondant chiffre avec ta clé publique. Toi seul peux déchiffrer avec ta clé privée, même si le message est intercepté.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <MatrixRain />
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div className="rise">
            <p className="mb-4 text-xs tracking-[0.3em] text-cyan glow-cyan">{"// LABORATOIRE DE CRYPTOGRAPHIE"}</p>
            <h1 className="font-display text-5xl leading-none font-bold tracking-tight sm:text-7xl">
              <span className="glitch" data-text="CIPHER">
                CIPHER
              </span>
              <span className="text-neon glow">{"//"}</span>
              <span className="glitch" data-text="LAB">
                LAB
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-mute sm:text-base">
              Le chiffrement <span className="text-ink">RSA</span> de bout en bout : de{" "}
              <span className="text-neon">n = p × q</span> jusqu&apos;au message secret. Crée ton compte et discute en{" "}
              <span className="text-ink">chat chiffré</span>, explore RSA dans le labo, et relève le défi{" "}
              <span className="text-amber">TITAN</span> : deux nombres premiers de plus d&apos;un million de chiffres chacun.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="rounded border border-neon bg-neon/15 px-5 py-3 text-sm font-semibold tracking-wider text-neon uppercase shadow-[0_0_24px_-6px_var(--color-neon)] transition hover:bg-neon hover:text-void"
              >
                ▶ Ouvrir le chat chiffré
              </Link>
              <Link
                href="/lab"
                className="rounded border border-line-strong px-5 py-3 text-sm font-semibold tracking-wider text-ink uppercase transition hover:border-neon hover:text-neon"
              >
                ⌬ Labo RSA
              </Link>
              <Link
                href="/titan"
                className="rounded border border-amber/60 px-5 py-3 text-sm font-semibold tracking-wider text-amber uppercase transition hover:bg-amber hover:text-void"
              >
                ⚡ Défi Titan
              </Link>
            </div>
          </div>
          <div className="rise rounded-lg border border-line bg-void/85 p-4 box-glow backdrop-blur" style={{ animationDelay: "120ms" }}>
            <div className="mb-3 flex items-center gap-1.5 border-b border-line pb-2" aria-hidden>
              <span className="size-2.5 rounded-full bg-danger/70" />
              <span className="size-2.5 rounded-full bg-amber/70" />
              <span className="size-2.5 rounded-full bg-neon/70" />
              <span className="ml-2 text-[11px] text-mute">root@cipherlab:~</span>
            </div>
            <BootSequence />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-px border-x border-line bg-line sm:grid-cols-3">
        {[
          ["6 152 906", "chiffres dans le n du mode Titan"],
          ["4096", "bits max pour tes clés RSA"],
          ["0", "octet de clé privée envoyé au serveur"],
        ].map(([v, l]) => (
          <div key={l} className="bg-void px-6 py-6">
            <div className="font-display text-3xl font-bold text-neon glow">{v}</div>
            <div className="mt-1 text-xs text-mute">{l}</div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-xs tracking-[0.3em] text-mute">{"// COMMENT ÇA MARCHE"}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-lg border border-line bg-panel p-5 transition hover:border-neon/50">
              <div className="font-display text-4xl font-bold text-line-strong">{s.n}</div>
              <h3 className="mt-2 font-semibold text-neon">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{s.text}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-16 mb-8 text-xs tracking-[0.3em] text-mute">{"// MODULES DE CHIFFREMENT"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SCHEMES.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border p-4 ${
                s.ready ? "border-neon/60 bg-neon/5 box-glow" : "border-line border-dashed opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-bold ${s.ready ? "text-neon glow" : "text-ink"}`}>{s.name}</span>
                <span className="text-[10px] text-mute">{s.year}</span>
              </div>
              <p className="mt-1 text-xs text-mute">{s.tagline}</p>
              <p className={`mt-3 text-[10px] tracking-widest uppercase ${s.ready ? "text-neon" : "text-mute"}`}>
                {s.ready ? "● en ligne" : "○ bientôt"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
