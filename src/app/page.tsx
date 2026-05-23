import { redirect } from "next/navigation";

/** Middleware normally sends `/` to `/login` or `/dashboard`; this is a safe fallback. */
export default function RootPage() {
  redirect("/login");
}
