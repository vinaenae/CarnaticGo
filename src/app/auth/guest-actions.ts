"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  GUEST_COOKIE_MAX_AGE,
  GUEST_COOKIE_NAME,
  GUEST_COOKIE_VALUE,
} from "@/lib/guest-mode";

export async function continueAsGuest() {
  const store = await cookies();
  store.set(GUEST_COOKIE_NAME, GUEST_COOKIE_VALUE, {
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/dashboard");
}

export async function clearGuestSession() {
  const store = await cookies();
  store.delete(GUEST_COOKIE_NAME);
}
