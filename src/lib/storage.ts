const DRAFT_PREFIX = "draft-";
const CANDIDATE_KEY = "AvroCandidateSelection";

export function loadCandidateSelections(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CANDIDATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveCandidateSelections(selections: Record<string, string>): void {
  try {
    localStorage.setItem(CANDIDATE_KEY, JSON.stringify(selections));
  } catch {
    // Ignore storage failures; typing still works.
  }
}

export function loadDraft(index: number): string {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${index}`);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "string" ? parsed : "";
  } catch {
    return "";
  }
}

export function saveDraft(index: number, value: string): void {
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${index}`, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export function readPreference<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writePreference(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}
