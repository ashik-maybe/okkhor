import { db, type Doc } from "./db";

const LEGACY_FLAG = "okkhor-legacy-migrated";
const WORDS_KEY = "okkhor-words";
const TITLE_LENGTH = 25;

export function makeTitle(content: string, index = 0): string {
  const firstLine = content.split("\n", 1)[0]?.trim() ?? "";
  if (!firstLine) return `Untitled ${index + 1}`;
  if (firstLine.length <= TITLE_LENGTH) return firstLine;

  const cut = firstLine.slice(0, TITLE_LENGTH);
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("।"));
  return (boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd() + "…";
}

export async function listDocs(): Promise<Doc[]> {
  const docs = await db.docs.toArray();
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createDoc(content = ""): Promise<number> {
  const now = Date.now();
  const id = await db.docs.add({
    title: makeTitle(content),
    content,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updateDoc(id: number, patch: Partial<Doc>): Promise<void> {
  await db.docs.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteDoc(id: number): Promise<void> {
  await db.docs.delete(id);
}

export function loadPersonalWords(): Map<string, number> {
  try {
    const raw = localStorage.getItem(WORDS_KEY);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return new Map(Object.entries(parsed as Record<string, number>));
    }
  } catch {
    // Ignore corrupt local data.
  }
  return new Map();
}

export function clearPersonalWords(): Map<string, number> {
  try {
    localStorage.removeItem(WORDS_KEY);
  } catch {
    // Ignore storage failures.
  }
  return new Map();
}

export function rememberWord(word: string): Map<string, number> {
  const words = loadPersonalWords();
  const key = word.normalize("NFC");
  words.set(key, (words.get(key) ?? 0) + 1);
  try {
    localStorage.setItem(WORDS_KEY, JSON.stringify(Object.fromEntries(words)));
  } catch {
    // Typing still works without persistence.
  }
  return words;
}

/** One-time import of the five localStorage drafts from the old AvroPad app. */
export async function migrateLegacyDrafts(): Promise<boolean> {
  let migrated = false;
  try {
    if (localStorage.getItem(LEGACY_FLAG) !== null) return false;
    for (let i = 0; i < 5; i += 1) {
      const raw = localStorage.getItem(`draft-${i}`);
      if (!raw) continue;
      const value: unknown = JSON.parse(raw);
      if (typeof value !== "string" || value.trim() === "") continue;
      await createDoc(value);
      migrated = true;
    }
    localStorage.setItem(LEGACY_FLAG, "1");
  } catch {
    // A failed migration must never block the app.
  }
  return migrated;
}
