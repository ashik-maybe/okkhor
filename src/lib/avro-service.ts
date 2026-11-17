import { loadAvro, type AvroInstance } from "../engine";
import { loadCandidateSelections, saveCandidateSelections } from "./storage";
import { MODERN_ALIASES } from "../data/modern-aliases";
import { getWordFrequency, loadWordFrequency, type FrequencyTable } from "../data/word-frequency";

export interface AvroCandidate {
  id: number;
  name: string;
}

export interface CandidateResult {
  query: string;
  candidates: AvroCandidate[];
  selectedIndex: number;
  rawQuery: string;
}

const ENGINE_BASE = 1000;
const ENGINE_STEP = 10;
const ALIAS_PREFIX = 100;
const ALIAS_EXACT = 2000;
const REMEMBERED = 2500;
// One zipf point is worth six alphabetical ranks. Capped so frequency can
// never outrank an exact alias or a word the user picked before.
const FREQUENCY_WEIGHT = 60;
const MAX_FREQUENCY = 8;

export async function loadEngine(): Promise<AvroInstance> {
  const [Avro] = await Promise.all([loadAvro(), loadWordFrequency().catch(() => undefined)]);
  return new Avro(loadCandidateSelections, saveCandidateSelections);
}

export function extractToken(subtext: string, isBanglaMode: boolean): string | null {
  if (!isBanglaMode) return null;
  const match = /\s?([^\s]+)$/.exec(subtext);
  if (!match) return null;
  const token = match[1];
  if (/[\u0980-\u09FF]+$/.test(token)) return null;
  if (token.length > 20) return null;
  return token;
}

export function suggestCandidates(
  engine: AvroInstance,
  query: string,
  personalWords: ReadonlyMap<string, number>,
  frequency: FrequencyTable = getWordFrequency(),
  max = 20,
): CandidateResult {
  const normalizedQuery = query.toLowerCase().normalize("NFC");
  // Word -> score. The map keeps insertion order for stable tie-breaking.
  const pool = new Map<string, number>();
  const add = (value: string, score: number) => {
    const word = value.normalize("NFC");
    if (!word) return;
    pool.set(word, Math.max(pool.get(word) ?? Number.NEGATIVE_INFINITY, score));
  };

  let words: string[] = [];
  try {
    const suggestion = engine.suggest(query);
    words = suggestion.words;
  } catch {
    // The alias layer still works if the engine rejects a query.
  }

  for (const [index, word] of words.entries()) {
    add(word, ENGINE_BASE - index * ENGINE_STEP);
  }

  // The engine remembers the word the user last picked for this query.
  try {
    const remembered = engine.candidate(query);
    if (remembered) add(remembered, REMEMBERED);
  } catch {
    // Ignore a missing preference store.
  }

  for (const [key, value] of Object.entries(MODERN_ALIASES)) {
    if (key === normalizedQuery) {
      add(value, ALIAS_EXACT);
    } else if (key.startsWith(normalizedQuery) || normalizedQuery.startsWith(key)) {
      add(value, ALIAS_PREFIX);
    }
  }

  // Personal frequency only nudges candidates that are already relevant.
  // Injecting remembered words here used to flood the list and outrank the
  // word the user was actually typing.
  const scored = Array.from(pool, ([name, score]) => {
    const zipf = frequency.get(name);
    const prior = zipf ? Math.min(zipf, MAX_FREQUENCY) * FREQUENCY_WEIGHT : 0;
    return {
      name,
      score: score + prior + Math.min(personalWords.get(name) ?? 0, 5),
    };
  });
  scored.sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, max).map((entry, id) => ({ id, name: entry.name }));
  if (!candidates.some((candidate) => candidate.name === query)) {
    candidates.push({ id: candidates.length, name: query });
  }

  return {
    query,
    candidates: candidates.slice(0, max + 1),
    selectedIndex: 0,
    rawQuery: query,
  };
}

export function commitCandidate(engine: AvroInstance, query: string, value: string): void {
  try {
    engine.commit(query, value);
  } catch {
    // Keep typing usable if the engine rejects a commit.
  }
}
