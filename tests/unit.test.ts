import { describe, expect, it } from "vitest";
import { extractToken } from "../src/lib/avro-service";
import { makeTitle } from "../src/lib/documents";
import { safeFilename, toHtml } from "../src/lib/export";

describe("token extraction", () => {
  it("finds the trailing roman token in Bangla mode", () => {
    expect(extractToken("amar sonar", true)).toBe("sonar");
  });

  it("returns null in English mode and for Bangla endings", () => {
    expect(extractToken("amar", false)).toBeNull();
    expect(extractToken("আমি", true)).toBeNull();
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
