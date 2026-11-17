import frequencyUrl from "./word-frequency.tsv?url";

/** Zipf scores for common Bangla words, keyed by NFC word. */
export type FrequencyTable = ReadonlyMap<string, number>;

let table: FrequencyTable = new Map();
let pending: Promise<FrequencyTable> | undefined;

/** The table is empty until it loads; callers can rank with it or without it. */
export function getWordFrequency(): FrequencyTable {
  return table;
}

/**
 * Fetched as a hashed static asset, like the phonetic engine. A failed fetch
 * leaves the old table in place so ranking falls back to engine order.
 */
export function loadWordFrequency(): Promise<FrequencyTable> {
  if (!pending) {
    pending = fetch(frequencyUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Word frequency data: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        const next = new Map<string, number>();
        for (const line of text.split("\n")) {
          if (!line) continue;
          const [word, value] = line.split("\t");
          if (!word) continue;
          const zipf = Number(value);
          if (Number.isFinite(zipf)) next.set(word.normalize("NFC"), zipf);
        }
        table = next;
        return table;
      })
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
  }
  return pending;
}
