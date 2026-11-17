export interface KeymapEntry {
  keys: string;
  glyph: string;
  /** A word typed in full; every example is asserted against the engine in e2e. */
  example?: { roman: string; bangla: string };
  note?: string;
}

export interface KeymapGroup {
  title: string;
  entries: KeymapEntry[];
}

const example = (roman: string, bangla: string) => ({ roman, bangla });

/**
 * The mapping structure follows OmicronLab's "Bangla Typing with Avro Phonetic"
 * (3rd edition, 2011). Glyphs and examples are checked against the engine this
 * app ships; where the PDF advertises a key the engine does not honour (`kx`
 * for ক্ষ), it is left out rather than taught as fact.
 */
export const KEYMAP: KeymapGroup[] = [
  {
    title: "Vowels",
    entries: [
      { keys: "o", glyph: "অ", example: example("onek", "অনেক") },
      { keys: "a", glyph: "আ", example: example("amar", "আমার") },
      { keys: "i", glyph: "ই", example: example("iti", "ইতি") },
      { keys: "I, ee", glyph: "ঈ", example: example("Igol", "ঈগল") },
      { keys: "u, oo", glyph: "উ", example: example("ujan", "উজান") },
      { keys: "U", glyph: "ঊ", example: example("dUr", "দূর") },
      { keys: "rri", glyph: "ঋ", example: example("rriju", "ঋজু") },
      { keys: "e", glyph: "এ", example: example("emon", "এমন") },
      { keys: "OI", glyph: "ঐ", example: example("OIrabot", "ঐরাবত") },
      { keys: "O", glyph: "ও", example: example("OtoprOto", "ওতপ্রোত") },
      { keys: "OU", glyph: "ঔ", example: example("OUshodh", "ঔষধ") },
    ],
  },
  {
    title: "Vowel signs",
    entries: [
      { keys: "a", glyph: "া", example: example("amar", "আমার") },
      { keys: "i", glyph: "ি", example: example("ki", "কি") },
      { keys: "I, ee", glyph: "ী", example: example("nodI", "নদী") },
      { keys: "u, oo", glyph: "ু", example: example("khub", "খুব") },
      { keys: "U", glyph: "ূ", example: example("dUr", "দূর") },
      { keys: "rri", glyph: "ৃ", example: example("grriho", "গৃহ") },
      { keys: "e", glyph: "ে", example: example("ke", "কে") },
      { keys: "OI", glyph: "ৈ", example: example("kOI", "কৈ") },
      { keys: "O", glyph: "ো", example: example("kO", "কো") },
      { keys: "OU", glyph: "ৌ", example: example("kOU", "কৌ") },
    ],
  },
  {
    title: "Consonants",
    entries: [
      { keys: "k", glyph: "ক", example: example("k", "ক") },
      { keys: "kh", glyph: "খ", example: example("kh", "খ") },
      { keys: "g", glyph: "গ", example: example("g", "গ") },
      { keys: "gh", glyph: "ঘ", example: example("gh", "ঘ") },
      { keys: "Ng", glyph: "ঙ", example: example("Ng", "ঙ") },
      { keys: "c", glyph: "চ", example: example("c", "চ") },
      { keys: "ch", glyph: "ছ", example: example("ch", "ছ") },
      { keys: "j", glyph: "জ", example: example("j", "জ") },
      { keys: "jh", glyph: "ঝ", example: example("jh", "ঝ") },
      { keys: "NG", glyph: "ঞ", example: example("NG", "ঞ") },
      { keys: "T", glyph: "ট", example: example("T", "ট") },
      { keys: "Th", glyph: "ঠ", example: example("Th", "ঠ") },
      { keys: "D", glyph: "ড", example: example("D", "ড") },
      { keys: "Dh", glyph: "ঢ", example: example("Dh", "ঢ") },
      { keys: "N", glyph: "ণ", example: example("N", "ণ") },
      { keys: "t", glyph: "ত", example: example("t", "ত") },
      { keys: "th", glyph: "থ", example: example("th", "থ") },
      { keys: "d", glyph: "দ", example: example("d", "দ") },
      { keys: "dh", glyph: "ধ", example: example("dh", "ধ") },
      { keys: "n", glyph: "ন", example: example("n", "ন") },
      { keys: "p", glyph: "প", example: example("p", "প") },
      { keys: "ph, f", glyph: "ফ", example: example("ph", "ফ") },
      { keys: "b", glyph: "ব", example: example("b", "ব") },
      { keys: "bh, v", glyph: "ভ", example: example("bh", "ভ") },
      { keys: "m", glyph: "ম", example: example("m", "ম") },
      { keys: "z", glyph: "য", example: example("z", "য") },
      { keys: "r", glyph: "র", example: example("r", "র") },
      { keys: "l", glyph: "ল", example: example("l", "ল") },
      { keys: "sh, S", glyph: "শ", example: example("sh", "শ") },
      { keys: "Sh", glyph: "ষ", example: example("Sh", "ষ") },
      { keys: "s", glyph: "স", example: example("s", "স") },
      { keys: "h", glyph: "হ", example: example("h", "হ") },
      { keys: "R", glyph: "ড়", example: example("R", "ড়") },
      { keys: "Rh", glyph: "ঢ়", example: example("Rh", "ঢ়") },
      { keys: "y, Y", glyph: "য়", example: example("y", "য়") },
    ],
  },
  {
    title: "Marks & joining",
    entries: [
      { keys: "ng", glyph: "ং", example: example("bangla", "বাংলা"), note: "after a vowel" },
      { keys: ":", glyph: "ঃ" },
      { keys: "^", glyph: "ঁ" },
      { keys: "t``", glyph: "ৎ", example: example("t``", "ৎ") },
      { keys: ",,", glyph: "্", note: "hasanta" },
      { keys: "w", glyph: "ব-ফলা", example: example("bishwo", "বিশ্ব") },
      { keys: "y", glyph: "য-ফলা", example: example("bybohar", "ব্যবহার") },
      { keys: "Z", glyph: "য-ফলা", example: example("aZromeTik", "অ্যারমেটিক"), note: "forced" },
      { keys: "r", glyph: "র-ফলা", example: example("prosonno", "প্রসন্ন") },
      { keys: "m", glyph: "ম-ফলা", example: example("podma", "পদ্মা") },
      { keys: "rr", glyph: "রেফ", example: example("orrko", "অর্ক") },
      { keys: "`", glyph: "`", example: example("ek`Ta", "একটা"), note: "separates letters" },
    ],
  },
  {
    title: "Common conjuncts",
    entries: [
      { keys: "kkh", glyph: "ক্ষ", example: example("lokkhmi", "লক্ষ্মী") },
      { keys: "nt", glyph: "ন্ত", example: example("onto", "অন্ত") },
      { keys: "gg", glyph: "জ্ঞ", example: example("biggo", "বিজ্ঞ") },
      { keys: "mb", glyph: "ম্ব", example: example("sombol", "সম্বল") },
      { keys: "shw", glyph: "শ্ব", example: example("bishwo", "বিশ্ব") },
      { keys: "by", glyph: "ব্য", example: example("bybohar", "ব্যবহার") },
      { keys: "pr", glyph: "প্র", example: example("prosonno", "প্রসন্ন") },
      { keys: "dm", glyph: "দ্ম", example: example("podma", "পদ্মা") },
      { keys: "rk", glyph: "র্ক", example: example("orrko", "অর্ক") },
      { keys: "hm", glyph: "হ্ম", example: example("brahmoN", "ব্রাহ্মণ") },
    ],
  },
  {
    title: "Punctuation",
    entries: [
      { keys: ".", glyph: "।", example: example("bangla.", "বাংলা।"), note: "dari" },
      { keys: ".`", glyph: ".", note: "full stop" },
      { keys: "$", glyph: "৳", example: example("100$", "১০০৳"), note: "taka" },
      { keys: ":`", glyph: ":", note: "colon" },
      { keys: "; ? ! ( ) /", glyph: "as typed", note: "pass through" },
    ],
  },
];

export const KEYMAP_EXAMPLES = KEYMAP.flatMap((group) => group.entries)
  .map((entry) => entry.example)
  .filter((value): value is { roman: string; bangla: string } => Boolean(value));
