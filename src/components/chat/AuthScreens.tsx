"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Label, Panel, inputClass } from "@/components/ui";
import { Terminal } from "@/components/Terminal";
import { fingerprint } from "@/lib/crypto/registry";
import {
  api,
  deriveKeys,
  generateRsa,
  newSalt,
  openPrivateKey,
  sealPrivateKey,
  storeUnlocked,
  type Account,
  type MeResponse,
} from "@/lib/client/account";

type Log = (line: string) => void;

/** Déverrouille la clé privée chiffrée renvoyée par le serveur. */
async function unlock(me: MeResponse, password: string, log: Log): Promise<Account> {
  log("[*] Dérivation de la clé de déchiffrement (PBKDF2, 300 000 tours)…");
  const { encKey } = await deriveKeys(password, me.kdfSalt);
  log("[*] Ouverture de la clé privée RSA (AES-256-GCM)…");
  const privateKey = await openPrivateKey(me.encPrivateKey, encKey);
  if (privateKey.n !== me.publicKey.n) throw new Error("La clé privée ne correspond pas à la clé publique du compte");
  log(`[+] Clé privée déverrouillée — empreinte ${me.fingerprint}`);
  const account: Account = { username: me.username, fingerprint: me.fingerprint, publicKey: me.publicKey, privateKey };
  storeUnlocked(account);
  return account;
}

export function AuthScreen({ onReady }: { onReady: (a: Account) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const log: Log = (l) => setLines((prev) => [...prev.slice(-60), l]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLines([]);
    const u = username.trim().toLowerCase();
    try {
      if (!/^[a-z0-9_.-]{3,20}$/.test(u)) throw new Error("Pseudo : 3 à 20 caractères parmi a-z, 0-9, _ . -");
      if (mode === "register") {
        if (password.length < 8) throw new Error("Mot de passe : 8 caractères minimum");
        if (password !== confirm) throw new Error("Les deux mots de passe ne sont pas identiques");
        if (!understood) throw new Error("Coche la case pour confirmer que tu as compris l'avertissement");
      }
      setBusy(true);
      onReady(mode === "register" ? await register(u) : await login(u));
    } catch (err) {
      setError((err as Error).message);
      log(`[!] ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const register = async (u: string): Promise<Account> => {
    log(`> register --user ${u}`);
    const kdfSalt = newSalt();
    log("[*] Dérivation de deux clés depuis le mot de passe (PBKDF2, 300 000 tours)…");
    const { authKey, encKey } = await deriveKeys(password, kdfSalt);
    log("[+] Clé d'authentification et clé de chiffrement prêtes");
    const priv = await generateRsa(2048, log);
    const publicKey = { n: priv.n, e: priv.e };
    const fp = await fingerprint("RSA", publicKey);
    log("[*] Chiffrement de la clé privée avec ton mot de passe (AES-256-GCM)…");
    const encPrivateKey = await sealPrivateKey(priv, encKey);
    log("[*] Envoi au serveur : pseudo, clé publique, clé privée CHIFFRÉE…");
    await api("/api/auth/register", { username: u, kdfSalt, authKey, publicKey, encPrivateKey });
    log(`[+] Compte créé — empreinte ${fp}`);
    const account: Account = { username: u, fingerprint: fp, publicKey, privateKey: priv };
    storeUnlocked(account);
    return account;
  };

  const login = async (u: string): Promise<Account> => {
    log(`> login --user ${u}`);
    const { kdfSalt } = await api<{ kdfSalt: string }>(`/api/auth/params?username=${encodeURIComponent(u)}`);
    log("[*] Dérivation des clés depuis le mot de passe…");
    const { authKey } = await deriveKeys(password, kdfSalt);
    const me = await api<MeResponse>("/api/auth/login", { username: u, authKey });
    log("[+] Authentifié");
    return unlock(me, password, log);
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_1fr]">
      <div className="rise space-y-4">
        <p className="text-xs tracking-[0.3em] text-cyan glow-cyan">{"// CHAT CHIFFRÉ"}</p>
        <h1 className="font-display text-4xl font-bold">
          Messagerie <span className="text-neon glow">RSA</span> de bout en bout
        </h1>
        <ul className="space-y-2 text-sm text-mute">
          <li>
            <span className="text-neon">▸</span> Ta paire de clés RSA 2048 bits est générée <b className="text-ink">dans ton navigateur</b>.
          </li>
          <li>
            <span className="text-neon">▸</span> Ta clé privée est chiffrée avec ton mot de passe avant d&apos;être sauvegardée : le serveur ne peut pas
            l&apos;ouvrir.
          </li>
          <li>
            <span className="text-neon">▸</span> Chaque message est chiffré avec la clé publique du destinataire. Le serveur ne stocke que des blocs
            illisibles.
          </li>
        </ul>
        <Terminal lines={lines} busy={busy} className="max-h-64" />
      </div>

      <Panel title={mode === "login" ? "auth/login.sh" : "auth/register.sh"} className="h-fit">
        <div className="mb-5 grid grid-cols-2 rounded border border-line p-0.5 text-xs">
          {(
            [
              ["login", "Se connecter"],
              ["register", "Créer un compte"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              type="button"
              onClick={() => (setMode(m), setError(""))}
              className={`rounded px-3 py-2 transition ${mode === m ? "bg-neon/15 text-neon" : "text-mute hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Pseudo</Label>
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="awa"
              maxLength={20}
            />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {mode === "register" && (
            <>
              <div>
                <Label>Confirmer le mot de passe</Label>
                <input
                  type="password"
                  className={inputClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <label className="flex cursor-pointer gap-2.5 rounded border border-amber/40 bg-amber/5 p-3 text-xs leading-relaxed text-amber">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 accent-[var(--color-amber)]" />
                <span>
                  J&apos;ai compris : mon mot de passe protège ma clé privée. <b>Si je l&apos;oublie, personne ne pourra le réinitialiser</b> et
                  mes messages seront perdus.
                </span>
              </label>
            </>
          )}
          {error && <Alert>{error}</Alert>}
          <Button variant="primary" type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Calcul en cours…" : mode === "login" ? "▶ Se connecter" : "⚙ Générer mes clés et créer le compte"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}

export function UnlockScreen({ me, onReady, onLogout }: { me: MeResponse; onReady: (a: Account) => void; onLogout: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onReady(await unlock(me, password, () => {}));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Panel title="keyring/unlock.sh">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-mute">
            Connecté en tant que <b className="text-neon">{me.username}</b>. Ta clé privée est verrouillée dans ce nouvel onglet : saisis ton
            mot de passe pour la déchiffrer.
          </p>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            placeholder="Mot de passe"
          />
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <Button variant="primary" type="submit" disabled={busy || !password} className="flex-1">
              {busy ? "Déverrouillage…" : "🔓 Déverrouiller"}
            </Button>
            <Button type="button" onClick={onLogout}>
              Changer de compte
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
