"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getIsLocalhost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** Shown only when the app is opened on localhost — confirms you are not on production. */
export function LocalDevBanner() {
  const isLocalhost = useSyncExternalStore(subscribe, getIsLocalhost, () => false);
  if (!isLocalhost) return null;

  return (
    <div className="border-b border-primary/20 bg-primary/8 px-4 py-1.5 text-center text-xs text-muted-foreground">
      Local development —{" "}
      <span className="font-medium text-foreground">http://localhost:3000</span>
      {" · "}
      Production is{" "}
      <span className="font-medium text-foreground">https://ragifyapp.com</span>
    </div>
  );
}
