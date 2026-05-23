/**
 * HTMLMediaElement.play() rejects with AbortError when pause() runs before play resolves.
 * Common when switching tracks or scrubbing — not a user-facing failure.
 */
export function isPlayInterruptedError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

export async function safePlay(audio: HTMLAudioElement): Promise<boolean> {
  try {
    await audio.play();
    return true;
  } catch (err) {
    if (isPlayInterruptedError(err)) return false;
    throw err;
  }
}

export function safePause(audio: HTMLAudioElement | null | undefined): void {
  if (!audio) return;
  try {
    audio.pause();
  } catch {
    /* ignore */
  }
}
