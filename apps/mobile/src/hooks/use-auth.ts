import { useState, useEffect, useCallback } from "react";
import { isAuthenticated, clearTokens } from "../services/api";
import { logout as authLogout } from "../services/auth";

/**
 * Lightweight auth state hook for controlling navigation guards.
 * Checks AsyncStorage for an existing token on mount.
 */
export function useAuth() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void isAuthenticated().then(setLoggedIn);
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setLoggedIn(false);
  }, []);

  const onLoginSuccess = useCallback(() => {
    setLoggedIn(true);
  }, []);

  return { loggedIn, logout, onLoginSuccess };
}
