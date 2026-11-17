import { describe, expect, it } from "vitest";
import { extractToken, suggestCandidates } from "../src/lib/avro-service";
import { commitSuffix } from "../src/lib/typing";
import { makeTitle } from "../src/lib/documents";
import { safeFilename, toHtml } from "../src/lib/export";
import { wordLabel } from "../src/lib/text";

describe("token extraction", () => {
  it("finds the trailing roman token in Bangla mode", () => {
    expect(extractToken("amar sonar", true)).toBe("sonar");
  });

  it("returns null in English mode and for Bangla endings", () => {
    expect(extractToken("amar", false)).toBeNull();
    expect(extractToken("আমি", true)).toBeNull();
  });
});

describe("commit keys", () => {
  it("commits on word-ending keys only when candidates are visible", () => {
    expect(commitSuffix(" ", true)).toBe(" ");
    expect(commitSuffix("Tab", true)).toBe(" ");
    expect(commitSuffix("Enter", true)).toBe(" ");
    expect(commitSuffix("।", true)).toBe("।");
    expect(commitSuffix(".", true)).toBe(".");
    expect(commitSuffix("a", true)).toBeNull();
    expect(commitSuffix(" ", false)).toBeNull();
  });
});

describe("candidate ranking", () => {
  const engine = {
    suggest: (query: string) => ({
      words: query === "ami" ? ["আমি", "আমই", "এমই"] : ["স্মারতফনে"],
      prevSelection: 0,
    }),
    commit: () => {},
    candidate: () => undefined,
  };

  it("does not let remembered words outrank the typed word", () => {
    const result = suggestCandidates(engine, "ami", new Map([["ভাল", 3]]));
    expect(result.candidates[0]?.name).toBe("আমি");
    expect(result.candidates.map((item) => item.name)).not.toContain("ভাল");
    expect(result.candidates[1]?.name).toBe("আমই");
  });

  it("prefers an exact modern alias over the legacy engine result", () => {
    const result = suggestCandidates(engine, "smartphone", new Map());
    expect(result.candidates[0]?.name).toBe("স্মার্টফোন");
  });

  it("front-loads a word the user picked before", () => {
    const result = suggestCandidates({ ...engine, candidate: () => "আমই" }, "ami", new Map());
    expect(result.candidates[0]?.name).toBe("আমই");
  });

  it("keeps the raw query as a fallback option", () => {
    const result = suggestCandidates(engine, "ami", new Map());
    expect(result.candidates.at(-1)?.name).toBe("ami");
  });
});

describe("frequency ranking", () => {
  const engine = {
    suggest: (query: string) => ({
      words: query === "bari" ? ["বারি", "বারই", "বাড়ি"] : ["আমি", "আমই"],
      prevSelection: 0,
    }),
    commit: () => {},
    candidate: () => undefined,
  };

  it("promotes a common word over an alphabetically earlier rare one", () => {
    const frequency = new Map([
      ["বারি", 3.59],
      ["বাড়ি", 5.55],
    ]);
    const result = suggestCandidates(engine, "bari", new Map(), frequency);
    expect(result.candidates[0]?.name).toBe("বাড়ি");
  });

  it("keeps engine order for words the table does not know", () => {
    const result = suggestCandidates(engine, "bari", new Map(), new Map());
    expect(result.candidates[0]?.name).toBe("বারি");
  });

  it("never lets frequency outrank a remembered choice", () => {
    const frequency = new Map([["আমই", 9]]);
    const result = suggestCandidates(
      { ...engine, candidate: () => "আমই" },
      "ami",
      new Map(),
      frequency,
    );
    expect(result.candidates[0]?.name).toBe("আমই");
  });

  it("never lets frequency outrank an exact alias", () => {
    const frequency = new Map([["স্মারতফনে", 9]]);
    const result = suggestCandidates(engine, "smartphone", new Map(), frequency);
    expect(result.candidates[0]?.name).toBe("স্মার্টফোন");
  });
});

describe("word count labels", () => {
  it("uses the singular for one word", () => {
    expect(wordLabel(1)).toBe("1 word");
  });

  it("uses the plural for zero and many", () => {
    expect(wordLabel(0)).toBe("0 words");
    expect(wordLabel(12)).toBe("12 words");
  });
});

describe("document helpers", () => {
  it("builds a title from the first line", () => {
    expect(makeTitle("Hello world\nmore text")).toBe("Hello world");
  });

  it("truncates long titles on a word boundary", () => {
    const title = makeTitle("one two three four five six seven eight nine");
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(26);
  });

  it("makes safe filenames", () => {
    expect(safeFilename("ধন্যবাদ! / report")).toBe("ধন্যবাদ  report");
  });

  it("escapes HTML on export", () => {
    const html = toHtml("<b>টি</b>", "a & b");
    expect(html).toContain("&lt;b&gt;টি&lt;/b&gt;");
    expect(html).toContain("a &amp; b");
  });
});
