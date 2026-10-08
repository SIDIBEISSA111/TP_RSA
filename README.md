# CIPHER//LAB — TP RSA

Application web de cryptographie RSA, avec une interface façon terminal.
En ligne : https://cipher-lab-tau.vercel.app

## Fonctionnalités

- **Réseau chiffré** (`/chat`) : création de compte (pseudo et mot de passe) et réseau de messages chiffrés en RSA-2048.
  - À l'inscription, la clé publique (n, e) est publiée dans l'**annuaire**, visible par tous.
  - Un message est chiffré avec la clé publique du destinataire puis **diffusé à tout le réseau** : tous les utilisateurs le voient (onglet Réseau), chacun peut cliquer sur « Déchiffrer avec ma clé privée », mais seul le destinataire y parvient. Chaque étape (chiffrement, diffusion, déchiffrement) est affichée.
  - La paire de clés RSA est générée dans le navigateur.
  - Le mot de passe ne quitte jamais le navigateur. On en dérive deux clés avec PBKDF2-SHA256 (300 000 itérations) :
    - une clé d'authentification, envoyée au serveur, qui la hache ensuite avec scrypt ;
    - une clé AES-256-GCM, qui chiffre la clé privée RSA avant qu'elle soit stockée sur le serveur.
  - Chaque message est chiffré deux fois : avec la clé publique du destinataire, et avec celle de l'expéditeur pour qu'il puisse relire ses propres messages.
  - Le serveur (PostgreSQL) ne stocke que des blocs chiffrés.
  - On peut vérifier les empreintes SHA-256 des clés pour détecter une attaque de l'homme du milieu.
- **Labo** (`/lab`) :
  - génération de clés de 512 à 4096 bits (crible et Miller-Rabin), ou à partir de p, q et e choisis à la main avec le détail des calculs ;
  - chiffrement PKCS#1 v1.5 et déchiffrement accéléré par le théorème des restes chinois ;
  - trousseau de clés local, avec import et export.
- **Titan** (`/titan`) : l'exigence du TP. Deux nombres premiers de plus d'un million de chiffres et leur produit.
  - p = 2^6972593 − 1 (2 098 960 chiffres) et q = 2^13466917 − 1 (4 053 946 chiffres), deux nombres premiers de Mersenne certifiés par le projet GIMPS ;
  - n = p × q (6 152 906 chiffres), calculé en environ 0,2 s ;
  - chiffrement avec e = 65537 (environ 30 s), et estimation mesurée du temps de déchiffrement ;
  - attaque qui factorise n parce que p et q sont publics ;
  - page **Premiers** (`/premiers`, aussi dans l'onglet `/titan#nombres`) : tous les chiffres de p, q et n, page par page, avec téléchargement. Le navigateur peut recalculer chaque nombre et comparer son empreinte SHA-256 avec le fichier publié. Une démo du test de Lucas-Lehmer est incluse.
- **Apprendre** (`/learn`) : RSA expliqué pas à pas.

Les fichiers `public/primes/*.txt` sont générés par `node scripts/gen-primes.mjs`.

## Développement

```bash
npm install
npm run dev     # http://localhost:3000 — base locale PGlite (dossier .pglite), aucune installation requise
npm test        # tests du moteur RSA et du serveur
```

En production, il faut définir deux variables d'environnement :

- `DATABASE_URL` : base PostgreSQL, fournie par l'intégration Neon de Vercel ;
- `SESSION_SECRET` : au moins 32 caractères aléatoires.

## Ajouter une méthode de chiffrement

1. Écrire le module dans `src/lib/crypto/` (voir `rsa.ts`).
2. L'enregistrer dans `src/lib/crypto/registry.ts` (interface `CipherScheme`), puis passer `ready: true` dans `SCHEMES`.
