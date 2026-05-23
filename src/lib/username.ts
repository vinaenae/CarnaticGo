/** Username rules: 3–24 chars, lowercase letters, digits, underscore; must start with a letter. */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsernameFormat(username: string): boolean {
  return /^[a-z][a-z0-9_]{2,23}$/.test(username);
}

export function usernameValidationMessage(username: string): string | null {
  const u = normalizeUsername(username);
  if (!u) return "Username is required.";
  if (u.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (u.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters.`;
  if (!/^[a-z]/.test(u)) return "Username must start with a letter.";
  if (!/^[a-z0-9_]+$/.test(u)) return "Use only lowercase letters, numbers, and underscores.";
  if (!isValidUsernameFormat(u)) return "Invalid username format.";
  return null;
}
