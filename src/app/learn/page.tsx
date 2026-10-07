import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Comprendre RSA — CIPHER//LAB" };

const KEYGEN = [
  ["Choisir deux grands nombres premiers", "p et q, secrets, tirés au hasard (1024 bits chacun pour une clé de 2048 bits)."],
  ["Calculer le module", "n = p × q. Il est public : c'est lui qui donne la « taille » de la clé."],
  ["Calculer l'indicatrice d'Euler", "φ(n) = (p − 1)(q − 1). Elle reste secrète : la connaître revient à connaître p et q."],
  ["Choisir l'exposant public", "e tel que 1 < e < φ(n) et pgcd(e, φ(n)) = 1. En pratique e = 65 537."],
  ["Calculer l'exposant privé", "d = e⁻¹ mod φ(n), par l'algorithme d'Euclide étendu. Ainsi e × d ≡ 1 (mod φ(n))."],
];

export default function LearnPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-12 px-4 py-10 text-sm leading-relaxed">
      <header>
        <p className="text-xs tracking-[0.3em] text-cyan glow-cyan">{"// APPRENDRE"}</p>
        <h1 className="mt-1 font-display text-4xl font-bold">
          Comprendre <span className="text-neon glow">RSA</span>
        </h1>
        <p className="mt-4 text-mute">
          Publié en 1977 par Ron Rivest, Adi Shamir et Leonard Adleman, RSA est un chiffrement{" "}
          <b className="text-ink">asymétrique</b> : on chiffre avec une clé publique que tout le monde peut connaître,
          et seul le détenteur de la clé privée peut déchiffrer. Sa sécurité repose sur un fait simple :{" "}
          <span className="text-neon">multiplier deux grands nombres premiers est facile, retrouver ces deux nombres à
          partir de leur produit est extrêmement difficile.</span>
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-xs tracking-[0.3em] text-mute">{"// 1. GÉNÉRATION DES CLÉS"}</h2>
        <ol className="space-y-3">
          {KEYGEN.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded border border-line bg-panel p-4">
              <span className="font-display text-2xl font-bold text-line-strong">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="font-semibold text-neon">{t}</div>
                <div className="text-mute">{d}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-cyan/40 bg-cyan/5 p-4">
            <div className="text-[11px] tracking-widest text-cyan">CLÉ PUBLIQUE</div>
            <div className="mt-1 font-display text-2xl text-ink">(n, e)</div>
          </div>
          <div className="rounded border border-danger/40 bg-danger/5 p-4">
            <div className="text-[11px] tracking-widest text-danger">CLÉ PRIVÉE</div>
            <div className="mt-1 font-display text-2xl text-ink">d (et p, q)</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xs tracking-[0.3em] text-mute">{"// 2. CHIFFRER ET DÉCHIFFRER"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Formula label="Chiffrement (avec la clé publique)" f="c = mᵉ mod n" />
          <Formula label="Déchiffrement (avec la clé privée)" f="m = cᵈ mod n" />
        </div>
        <p className="mt-4 text-mute">
          Cela fonctionne grâce au théorème d&apos;Euler : comme e × d = 1 + k·φ(n), on a{" "}
          <span className="text-ink">(mᵉ)ᵈ = m · (m^φ(n))ᵏ ≡ m (mod n)</span>.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xs tracking-[0.3em] text-mute">{"// 3. EXEMPLE À LA MAIN"}</h2>
        <div className="rounded border border-line bg-void p-4 text-[13px] leading-loose">
          <Line k="p, q" v="61, 53" />
          <Line k="n" v="61 × 53 = 3233" />
          <Line k="φ(n)" v="60 × 52 = 3120" />
          <Line k="e" v="17   (pgcd(17, 3120) = 1 ✓)" />
          <Line k="d" v="2753   (17 × 2753 = 46 801 = 15 × 3120 + 1 ✓)" />
          <div className="my-2 border-t border-line" />
          <Line k="message" v="m = 65   (la lettre « A »)" />
          <Line k="chiffré" v="c = 65¹⁷ mod 3233 = 2790" accent />
          <Line k="déchiffré" v="2790²⁷⁵³ mod 3233 = 65 → « A » ✓" />
        </div>
        <p className="mt-3 text-mute">
          Refais exactement ce calcul dans le{" "}
          <Link href="/lab" className="text-neon underline-offset-4 hover:underline">
            labo
          </Link>
          , onglet Clés → mode labo → « Exemple du cours ».
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xs tracking-[0.3em] text-mute">{"// 4. CE QUE FAIT L'APPLICATION EN PLUS"}</h2>
        <ul className="space-y-3">
          <Item t="Test de Miller-Rabin">
            Pour trouver p et q, on tire des nombres impairs au hasard, on élimine ceux divisibles par un petit premier
            (crible), puis on applique 40 tours de Miller-Rabin. La probabilité d&apos;erreur est inférieure à 2⁻⁸⁰.
          </Item>
          <Item t="Bourrage PKCS#1 v1.5">
            Le RSA « de manuel » est déterministe : le même message donne toujours le même chiffré, ce qui permet de
            deviner des messages courts. On ajoute donc des octets aléatoires avant de chiffrer, et chiffrer deux fois
            le même texte donne deux résultats différents.
          </Item>
          <Item t="Théorème des restes chinois">
            Au lieu de calculer cᵈ mod n directement, on calcule modulo p et modulo q séparément puis on recombine :
            le déchiffrement est environ 4 fois plus rapide.
          </Item>
          <Item t="Empreinte de clé">
            Un résumé SHA-256 de la clé publique. Deux personnes peuvent le comparer à voix haute pour vérifier
            qu&apos;aucun intermédiaire n&apos;a substitué sa propre clé (attaque de l&apos;homme du milieu).
          </Item>
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-xs tracking-[0.3em] text-mute">{"// 5. POURQUOI C'EST SÛR… ET QUAND ÇA NE L'EST PAS"}</h2>
        <p className="text-mute">
          Le plus grand nombre RSA « challenge » factorisé publiquement fait 829 bits (RSA-250, en 2020), au prix de
          milliers d&apos;années-cœur de calcul. Une clé de 2048 bits est hors de portée des ordinateurs actuels. En
          revanche, une clé est cassée si ses premiers sont trop petits, trop proches l&apos;un de l&apos;autre, ou
          connus à l&apos;avance. Le{" "}
          <Link href="/titan" className="text-amber underline-offset-4 hover:underline">
            défi Titan
          </Link>{" "}
          le montre : une clé de 6 millions de chiffres construite avec des premiers publics se casse en une fraction
          de seconde.
        </p>
      </section>
    </article>
  );
}

function Formula({ label, f }: { label: string; f: string }) {
  return (
    <div className="rounded border border-line bg-panel p-5 text-center">
      <div className="text-[11px] tracking-widest text-mute uppercase">{label}</div>
      <div className="mt-2 font-display text-3xl text-neon glow">{f}</div>
    </div>
  );
}

function Line({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-mute">{k}</span>
      <span className={accent ? "text-amber" : "text-ink"}>{v}</span>
    </div>
  );
}

function Item({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <li className="rounded border border-line bg-panel p-4">
      <div className="font-semibold text-cyan">{t}</div>
      <div className="mt-1 text-mute">{children}</div>
    </li>
  );
}
