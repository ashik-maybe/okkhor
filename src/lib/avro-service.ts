import { loadAvro, type AvroInstance } from "../engine";
import { loadCandidateSelections, saveCandidateSelections } from "./storage";
import { MODERN_ALIASES } from "../data/modern-aliases";

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

export async function loadEngine(): Promise<AvroInstance> {
  const Avro = await loadAvro();
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
  max = 20,
): CandidateResult {
  const normalizedQuery = query.toLowerCase().normalize("NFC");
  const pool: Array<{ value: string; index: number }> = [];
  let index = 0;

  try {
    const suggestion = engine.suggest(query);
    for (const word of suggestion.words) {
      pool.push({ value: word.normalize("NFC"), index: index++ });
    }
    if (typeof suggestion.prevSelection === "number" && suggestion.prevSelection >= 0) {
      // preserve the engine's preferred selection as a hint via index 0 fallback
    }
  } catch {
    // Fall through to alias/personal candidates.
  }

  for (const [key, value] of Object.entries(MODERN_ALIASES)) {
    const canonical = value.normalize("NFC");
    if (key === normalizedQuery) {
      pool.push({ value: canonical, index: index++ });
    } else if (key.startsWith(normalizedQuery) || normalizedQuery.startsWith(key)) {
      pool.push({ value: canonical, index: index++ });
    }
  }

  for (const word of personalWords.keys()) {
    pool.push({ value: word.normalize("NFC"), index: index++ });
  }

  const seen = new Set<string>();
  const unique = pool.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });

  const scored = unique.map((item) => {
    let score = 0;
    if (MODERN_ALIASES[normalizedQuery] === item.value) score += 100;
    const personalCount = personalWords.get(item.value) ?? 0;
    if (personalCount > 0) score += 10 + personalCount * 2;
    for (const [key, value] of Object.entries(MODERN_ALIASES)) {
      if (
        value === item.value &&
        (key.startsWith(normalizedQuery) || normalizedQuery.startsWith(key))
      ) {
        score += 5;
      }
    }
    // Prefer shorter candidate lists' natural engine order via negative index.
    score += Math.max(0, 5 - item.index * 0.01);
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score || a.item.index - b.item.index);

  const candidates = scored.slice(0, max).map((entry, id) => ({ id, name: entry.item.value }));

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
