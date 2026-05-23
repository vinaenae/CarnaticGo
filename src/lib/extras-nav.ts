/** Extras nav — tools outside core practice & quizzes. */

export const EXTRAS_NAV_ITEMS = [
  {
    id: "gamaka-detection",
    label: "Gamaka detection",
    comingSoon: true,
  },
  {
    id: "raga-identifier",
    label: "Raga identifier",
    comingSoon: true,
  },
] as const;

export type ExtrasNavItemId = (typeof EXTRAS_NAV_ITEMS)[number]["id"];

export function isExtrasPath(path: string) {
  return path.startsWith("/extras") || path.startsWith("/sing-along");
}

export function activeExtrasNavItem(pathname: string): ExtrasNavItemId | null {
  if (pathname.startsWith("/sing-along")) return null;
  if (pathname.startsWith("/extras/gamaka-detection")) return "gamaka-detection";
  if (pathname.startsWith("/extras/raga-identifier")) return "raga-identifier";
  return null;
}
