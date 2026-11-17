const MODE_KEY = "okkhor-bangla-mode";
const HINT_KEY = "okkhor-hints-seen";

export function loadBanglaMode(): boolean {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function saveBanglaMode(enabled: boolean): void {
  try {
    localStorage.setItem(MODE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

export function hasSeenHints(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHintsSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}
