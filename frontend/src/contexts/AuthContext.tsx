import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { api, getToken, setToken } from "@/src/lib/api";

export type User = {
  user_id: string;
  email: string;
  name: string;
  provider?: string;
  avatar?: string | null;
  theme?: string;
  language?: string;
  notifications_enabled?: boolean;
  best_streak?: number;
  current_streak?: number;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signup: (name: string, email: string, password: string, remember: boolean) => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ dev_token?: string; message: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUserPartial: (patch: Partial<User>) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const tok = await getToken();
      if (!tok) {
        setUser(null);
        return;
      }
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signup = async (name: string, email: string, password: string, remember: boolean) => {
    const res = await api<{ access_token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password, remember }),
      auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
  };

  const login = async (email: string, password: string, remember: boolean) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
      auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
  };

  const exchangeSession = async (sessionId: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/google-session", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
      auth: false,
    });
    await setToken(res.access_token);
    setUser(res.user);
  };

  const loginWithGoogle = async () => {
    const redirectUrl =
      Platform.OS === "web"
        ? `${(globalThis as any).window?.location?.origin || ""}/`
        : Linking.createURL("auth");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      (globalThis as any).window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== "success" || !result.url) return;
    const url = result.url;
    const fragment = url.includes("#") ? url.split("#")[1] : "";
    const queryStr = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
    const sp1 = new URLSearchParams(fragment);
    const sp2 = new URLSearchParams(queryStr);
    const sessionId = sp1.get("session_id") || sp2.get("session_id");
    if (!sessionId) return;
    await exchangeSession(sessionId);
  };

  // On web, parse session_id on mount if present
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const w: any = globalThis;
    if (!w.window) return;
    const hash = w.window.location.hash?.startsWith("#") ? w.window.location.hash.slice(1) : "";
    const qs = w.window.location.search?.startsWith("?") ? w.window.location.search.slice(1) : "";
    const sp = new URLSearchParams(hash || qs);
    const sid = sp.get("session_id");
    if (sid) {
      exchangeSession(sid)
        .then(() => {
          w.window.history.replaceState(null, "", w.window.location.pathname);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forgotPassword = async (email: string) => {
    return api<{ dev_token?: string; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    });
  };

  const resetPassword = async (token: string, newPassword: string) => {
    await api("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
      auth: false,
    });
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await setToken(null);
    setUser(null);
  };

  const setUserPartial = (patch: Partial<User>) => setUser((u) => (u ? { ...u, ...patch } : u));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signup,
        login,
        loginWithGoogle,
        forgotPassword,
        resetPassword,
        logout,
        refresh,
        setUserPartial,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
