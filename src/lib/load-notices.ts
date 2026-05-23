import { readFile } from "fs/promises";
import path from "path";

/** Load `public/NOTICES.md` (single source for About / Legal). */
export async function loadNoticesMarkdown(): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "NOTICES.md");
  return readFile(filePath, "utf-8");
}
