import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { SessionUser } from "../types/chat";

const STORAGE_KEY = "trackngo.session.user";

interface SessionContextValue {
  currentUser: SessionUser | null;
  loading: boolean;
  setCurrentUser: (user: SessionUser) => Promise<void>;
  clearCurrentUser: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUserState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // TEMPORARY: Clear session for testing
        await AsyncStorage.removeItem(STORAGE_KEY);

        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setCurrentUserState(JSON.parse(raw));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setCurrentUser = useCallback(async (user: SessionUser) => {
    setCurrentUserState(user);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, []);

  const clearCurrentUser = useCallback(async () => {
    setCurrentUserState(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      loading,
      setCurrentUser,
      clearCurrentUser
    }),
    [currentUser, loading, setCurrentUser, clearCurrentUser]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}