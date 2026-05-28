/** Cookie-backed guest session (no Supabase account). */
export const GUEST_COOKIE_NAME = "ragify_guest";
export const GUEST_COOKIE_VALUE = "1";
/** 1 year — cleared on sign-in or sign-out. */
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isGuestCookieValue(value: string | undefined): boolean {
  return value === GUEST_COOKIE_VALUE;
}
