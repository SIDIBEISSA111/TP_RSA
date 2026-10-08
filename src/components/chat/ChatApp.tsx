"use client";

import { useEffect, useState } from "react";
import { api, HttpError, loadUnlocked, storeUnlocked, type Account, type MeResponse } from "@/lib/client/account";
import { AuthScreen, UnlockScreen } from "./AuthScreens";
import { NetworkShell } from "@/components/network/NetworkShell";

type State =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "locked"; me: MeResponse }
  | { status: "ready"; account: Account; fresh: boolean }
  | { status: "error"; message: string };

export function ChatApp() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    api<MeResponse>("/api/me")
      .then((me) => {
        const unlocked = loadUnlocked(me.username);
        setState(unlocked ? { status: "ready", account: unlocked, fresh: false } : { status: "locked", me });
      })
      .catch((err) => {
        if (err instanceof HttpError && err.status === 401) setState({ status: "anon" });
        else setState({ status: "error", message: err.message });
      });
  }, []);

  const logout = async () => {
    storeUnlocked(null);
    await api("/api/auth/logout", {}).catch(() => {});
    setState({ status: "anon" });
  };

  const ready = (account: Account, fresh = false) => setState({ status: "ready", account, fresh });

  switch (state.status) {
    case "loading":
      return <div className="cursor p-10 text-center text-sm text-mute">connexion au serveur</div>;
    case "error":
      return <div className="p-10 text-center text-sm text-danger">[!] {state.message}</div>;
    case "anon":
      return <AuthScreen onReady={ready} />;
    case "locked":
      return <UnlockScreen me={state.me} onReady={ready} onLogout={logout} />;
    case "ready":
      return <NetworkShell account={state.account} fresh={state.fresh} onLogout={logout} />;
  }
}
