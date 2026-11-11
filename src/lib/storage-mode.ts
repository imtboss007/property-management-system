export type AxivestraStorageMode = "account" | "local";

export const AXIVESTRA_STORAGE_MODE_KEY = "axivestra.storageMode";

export function readStoredStorageMode(): AxivestraStorageMode | null {
  try {
    const value = typeof localStorage === "undefined" ? null : localStorage.getItem(AXIVESTRA_STORAGE_MODE_KEY);
    return value === "account" || value === "local" ? value : null;
  } catch {
    return null;
  }
}

/** Existing signed-in workspaces retain their previous account-scoped behavior unless the user explicitly chooses Local Only. */
export function getStorageMode(): AxivestraStorageMode {
  const selected = readStoredStorageMode();
  if (selected) return selected;
  try {
    if (typeof localStorage !== "undefined" &&
      (localStorage.getItem("axivestra.activeCompanyId") || localStorage.getItem("axivestra.activePersonalUserId"))) {
      return "account";
    }
  } catch {
    // A blocked storage API falls back to the private device-only path.
  }
  return "local";
}

export function isLocalOnlySelected(): boolean {
  return readStoredStorageMode() === "local";
}

export function persistStorageMode(mode: AxivestraStorageMode): void {
  if (mode !== "account" && mode !== "local") throw new Error("Unknown AXIVESTRA storage mode.");
  if (typeof localStorage === "undefined") throw new Error("This device does not provide local storage.");
  localStorage.setItem(AXIVESTRA_STORAGE_MODE_KEY, mode);
}
