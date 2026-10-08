import type { Metadata } from "next";
import { PrimesClient } from "@/components/titan/PrimesClient";

export const metadata: Metadata = { title: "Nombres premiers d'un million de chiffres — CIPHER//LAB" };

export default function PrimesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-xs tracking-[0.3em] text-amber">{"// EXIGENCE DU TP"}</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
          Deux nombres premiers de <span className="text-amber">plus d&apos;un million</span> de chiffres
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-mute">
          Voici, chiffre par chiffre, les deux nombres premiers p et q utilisés par le mode Titan, et leur produit n = p × q,
          la clé publique RSA. Chaque nombre peut être recalculé dans ton navigateur pour prouver que les chiffres affichés
          sont exacts.
        </p>
      </header>
      <PrimesClient />
    </div>
  );
}
