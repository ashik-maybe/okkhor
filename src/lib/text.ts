/** One plural form for the word count in the editor meta and the document menu. */
export function wordLabel(count: number): string {
  return `${count} ${count === 1 ? "word" : "words"}`;
}
