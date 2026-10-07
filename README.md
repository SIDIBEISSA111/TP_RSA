# CIPHER//LAB

Laboratoire de cryptographie RSA, en interface web façon terminal.

- **Labo** : génération de clés RSA (512 à 4096 bits, ou p, q, e choisis à la main avec le détail des calculs), chiffrement et déchiffrement de messages, trousseau de clés local.
- **Titan** : RSA avec deux nombres premiers de plus d'un million de chiffres (Mersenne 2^6972593−1 et 2^13466917−1) : produit, chiffrement, estimation du déchiffrement, et attaque.
- **Apprendre** : RSA expliqué pas à pas.

Tous les calculs tournent dans le navigateur (Web Workers). Aucune clé privée n'est envoyée à un serveur.

## Développement

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # tests du moteur RSA
```

## Ajouter une méthode de chiffrement

1. Écrire le module dans `src/lib/crypto/` (voir `rsa.ts`).
2. L'enregistrer dans `src/lib/crypto/registry.ts` (interface `CipherScheme`) et passer `ready: true` dans `SCHEMES`.
