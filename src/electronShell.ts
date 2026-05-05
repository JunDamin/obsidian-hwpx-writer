/**
 * Electron `shell` wrapper.
 *
 * The plugin is `isDesktopOnly: true`, so `electron.shell` is always available
 * at runtime. Wrapping it in this single module keeps the platform-specific
 * surface area auditable in one place and lets callers stay platform-agnostic.
 *
 * Each helper guards with `Platform.isDesktopApp` defensively so a future
 * mobile entry point cannot crash; on mobile they degrade to no-op `false`.
 */

import { Platform } from "obsidian";
import { shell } from "electron";

/** Opens a file or folder with the OS default handler. Returns true on success. */
export function openPathExternal(absPath: string): boolean {
  if (!Platform.isDesktopApp) return false;
  try {
    void shell.openPath(absPath);
    return true;
  } catch {
    return false;
  }
}

/** Reveals a file or folder in the OS file explorer. Returns true on success. */
export function showInFolder(absPath: string): boolean {
  if (!Platform.isDesktopApp) return false;
  try {
    shell.showItemInFolder(absPath);
    return true;
  } catch {
    return false;
  }
}
