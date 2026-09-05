/**
 * Ephemeral output directory for `bun check` artifacts.
 * Never commit — listed in .gitignore. CI uploads from here after a green gate.
 */
import { join } from "node:path";

export const COMPAT_OUT_DIR = ".compat-out";

export function compatOut(...parts: string[]): string {
  return join(COMPAT_OUT_DIR, ...parts);
}
