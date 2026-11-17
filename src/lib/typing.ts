/** Punctuation that ends a word and commits the current phonetic candidate. */
const COMMIT_PUNCTUATION = new Set(["।", ".", ",", "!", "?"]);

/**
 * Return the character a commit key should insert after the chosen word, or
 * null when the key is not a commit key (or no candidates are on screen).
 */
export function commitSuffix(key: string, candidatesVisible: boolean): string | null {
  if (!candidatesVisible) return null;
  if (key === " " || key === "Tab" || key === "Enter") return " ";
  if (COMMIT_PUNCTUATION.has(key)) return key;
  return null;
}
