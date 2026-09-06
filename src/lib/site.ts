/** Product name: tab title, header, auth screens. */
export const APP_NAME = "Ragify";

function normalizeOrigin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/$/, "");
}

/** Configured app origin from env (use for OAuth redirects in local dev). */
export function getConfiguredAppOrigin(): string | undefined {
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

/** Browser origin for OAuth redirects; prefers NEXT_PUBLIC_APP_URL in local dev. */
export function getClientAppOrigin(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = getConfiguredAppOrigin();
  if (fromEnv) return fromEnv;
  return window.location.origin;
}

/** Origin for auth redirects on the server; prefers NEXT_PUBLIC_APP_URL in development. */
export function getServerAppOrigin(requestUrl: string): string {
  const fromEnv = getConfiguredAppOrigin();
  if (process.env.NODE_ENV === "development" && fromEnv) {
    return fromEnv;
  }
  return new URL(requestUrl).origin;
}
