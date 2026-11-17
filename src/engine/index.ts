export interface AvroSuggestion {
  words: string[];
  prevSelection?: number;
}

export interface AvroInstance {
  suggest(query: string): AvroSuggestion;
  commit(query: string, value: string): void;
  candidate(query: string): string | undefined;
}

export type AvroConstructor = new (
  loadCandidateSelections: () => Record<string, string>,
  saveCandidateSelections: (selections: Record<string, string>) => void,
) => AvroInstance;

import engineUrl from "./avro.min.js?url";

/**
 * The 3.8 MB phonetic engine is a byte-identical 2013 Closure-compiled build
 * with an embedded Bangla dictionary. It relies on sloppy-mode implicit
 * globals, so it must run as a classic script; loading it from a hashed
 * `?url` asset on demand keeps it lazy without modifying a single byte.
 */
export async function loadAvro(): Promise<AvroConstructor> {
  const scope = window as Window & { AvroPhonetic?: AvroConstructor };
  if (scope.AvroPhonetic) return scope.AvroPhonetic;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = engineUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Avro phonetic engine"));
    document.head.appendChild(script);
  });

  const engine = scope.AvroPhonetic;
  if (!engine) throw new Error("The Avro engine did not register itself");
  return engine;
}
