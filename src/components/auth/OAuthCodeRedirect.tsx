"use client";

import { useEffect } from "react";

/**
 * Supabase sometimes returns the OAuth `code` to the Site URL (e.g. /login)
 * instead of /auth/callback when the redirect URL is not allow-listed.
 * Forward it to the callback route so the session exchange still completes.
 */
export function OAuthCodeRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const next = params.get("next") ?? "/dashboard";
    window.location.replace(
      `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`,
    );
  }, []);

  return null;
}
