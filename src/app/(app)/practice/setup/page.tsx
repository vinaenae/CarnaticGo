import { redirect } from "next/navigation";

/** Legacy URL — practice starts immediately without a setup screen. */
export default function PracticeSetupPage() {
  redirect("/practice/new");
}
