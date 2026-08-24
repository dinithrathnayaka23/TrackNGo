import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import type { SessionUser } from "../types/chat";
import { clearAuthToken, onUnauthorized } from "../services/http";

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
    await clearAuthToken();
  }, []);

  // The stored session outlives the JWT, so once the backend stops accepting our
  // token the app would otherwise keep acting logged in and fail every request.
  // Dropping the session here sends the user back through the login screen.
  useEffect(() => onUnauthorized(() => void clearCurrentUser()), [clearCurrentUser]);

  const value = useMemo(
    () => ({
      currentUser,
      loading,
      setCurrentUser,
      clearCurrentUser,
    }),
    [currentUser, loading, setCurrentUser, clearCurrentUser],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
