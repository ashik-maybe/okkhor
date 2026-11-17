// Playwright smoke checks for the Okkhor editor.
// Start `bun run preview --port 4173` first, then run `bun run test:e2e`.

import { chromium, type Locator, type Page } from "playwright";
import { KEYMAP_EXAMPLES } from "../src/lib/keymap";
import { GITHUB_URL } from "../src/lib/links";

const BASE = process.env.BASE ?? "http://localhost:4173/okkhor/";
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures.push(detail === undefined ? name : `${name}: ${JSON.stringify(detail)}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

async function clearEditor(editor: Locator) {
  await editor.focus();
  await editor.press("Control+A");
  await editor.press("Delete");
}

async function visibleOptions(page: Page): Promise<string[]> {
  return page.locator("[role=option]:visible").allInnerTexts();
}

async function openEditor(page: Page): Promise<Locator> {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#editor", { timeout: 20000 });
  return page.locator("#editor");
}

// HTML-level checks: what crawlers (which do not run JS) see before mount.
{
  const html = await (await fetch(BASE)).text();
  check(
    "server HTML carries a canonical link",
    html.includes('rel="canonical" href="https://ashik-maybe.github.io/okkhor/"'),
  );
  check(
    "server HTML has a keyword-rich title",
    html.includes("Avro Phonetic") && html.includes("<title>"),
  );
  check("server HTML is not an empty shell", html.includes("<h1>Okkhor — Bangla writing studio"));
  check(
    "server HTML answers the FAQ visibly",
    html.includes("Which keyboard does Okkhor use?") &&
      html.includes("Does Okkhor work offline?") &&
      html.includes("Where is my writing stored?"),
  );
  check(
    "server HTML shows a product screenshot with alt text",
    /<img[^>]+src="[^"]*images\/screenshot\.jpg"[^>]*alt="[^"]+"/.test(html),
  );
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((v): v is Record<string, unknown> => v !== null);
  const types = ldBlocks.map((v) => v["@type"]);
  check(
    "server HTML carries parseable JSON-LD",
    types.includes("SoftwareApplication") && types.includes("FAQPage"),
    types,
  );
  const software = ldBlocks.find((v) => v["@type"] === "SoftwareApplication");
  check(
    "SoftwareApplication schema claims no fabricated rating",
    software !== undefined && !("aggregateRating" in software),
  );
  const robotsRes = await fetch(new URL("robots.txt", BASE));
  const robotsText = await robotsRes.text();
  check(
    "robots.txt allows crawlers and points at the sitemap",
    robotsRes.status === 200 && robotsText.includes("Sitemap:"),
    { status: robotsRes.status },
  );
  const sitemapRes = await fetch(new URL("sitemap.xml", BASE));
  const sitemapText = await sitemapRes.text();
  check(
    "sitemap.xml lists the canonical URL",
    sitemapRes.status === 200 &&
      sitemapText.includes("https://ashik-maybe.github.io/okkhor/</loc>"),
    { status: sitemapRes.status },
  );
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const editor = await openEditor(page);

  check("editor is visible", await editor.isVisible());
  check(
    "first run teaches the one mechanic",
    await page.getByText("Type roman letters. Press Space to choose a Bangla word.").isVisible(),
  );
  check(
    "editor sits on a paper surface",
    await editor.evaluate(
      (node) => getComputedStyle(node.parentElement!).backgroundColor !== "rgba(0, 0, 0, 0)",
    ),
  );
  check("writing measure is capped", ((await editor.boundingBox())?.width ?? 0) <= 900);
  check(
    "focus does not paint a rule on the paper",
    await editor.evaluate((node) => !getComputedStyle(node).boxShadow.includes("inset")),
  );
  const paperRule = await editor.evaluate(
    (node) => getComputedStyle(node.parentElement!).borderTopColor,
  );
  await editor.click();
  // The paper animates its border over ~150ms. Poll for the settled hairline
  // instead of sampling the first frame, which raced in CI and failed even
  // though the focus style was correct.
  let focusedRule = paperRule;
  try {
    await page.waitForFunction(
      (before) => {
        const paper = document.querySelector("#editor")?.parentElement;
        return paper ? getComputedStyle(paper).borderTopColor !== before : false;
      },
      paperRule,
      { timeout: 2000 },
    );
    focusedRule = await editor.evaluate(
      (node) => getComputedStyle(node.parentElement!).borderTopColor,
    );
  } catch {
    // A timeout leaves focusedRule === paperRule, so the check fails below.
  }
  check("focused paper gets a hairline", focusedRule !== paperRule, {
    paperRule,
    focusedRule,
  });
  for (const [name, asset] of [
    ["favicon", "favicon.ico"],
    ["logo", "images/logo.svg"],
    ["apple touch icon", "images/apple-touch-icon.png"],
    ["social card", "images/og.png"],
  ]) {
    check(
      `${name} asset is served`,
      (await page.request.get(new URL(asset, BASE).toString())).ok(),
    );
  }
  check("header logo is shown", await page.locator('img[src$="logo.svg"]').first().isVisible());
  check("no tools rail", (await page.getByText("Tools", { exact: true }).count()) === 0);
  check(
    "brand appears once",
    (await page
      .getByText("অক্ষর", { exact: true })
      .evaluateAll(
        (nodes) => nodes.filter((node) => node.getBoundingClientRect().height > 0).length,
      )) === 1,
  );
  check(
    "active draft has a primary rule",
    await page
      .locator('[aria-current="page"]')
      .first()
      .evaluate((node) => getComputedStyle(node).borderLeftColor !== "rgba(0, 0, 0, 0)"),
  );
  await page.getByRole("button", { name: "Document actions" }).click();
  check(
    "document menu holds export actions",
    await page.getByRole("menuitem", { name: "Export .txt" }).isVisible(),
  );
  check(
    "document menu offers copy everything",
    await page.getByRole("menuitem", { name: "Copy everything" }).isVisible(),
  );
  check(
    "document menu can clear personal words",
    await page.getByRole("menuitem", { name: "Clear personal words" }).isVisible(),
  );
  await page.keyboard.press("Escape");

  const headerSource = page.locator("header").getByRole("link", { name: "View source on GitHub" });
  check("GitHub icon is in the header", await headerSource.isVisible());
  check("GitHub icon points at the repo", (await headerSource.getAttribute("href")) === GITHUB_URL);
  check(
    "GitHub icon opens safely",
    (await headerSource.getAttribute("target")) === "_blank" &&
      Boolean((await headerSource.getAttribute("rel"))?.includes("noreferrer")),
  );

  await page.keyboard.press("Control+k");
  check("palette can jump to drafts", await page.getByText("Jump to draft").isVisible());
  check(
    "palette offers the GitHub source",
    await page.getByText("View source on GitHub").isVisible(),
  );
  const searchInput = page.getByPlaceholder("Search drafts and commands…");
  check("palette has a visible search field", await searchInput.isVisible());
  check(
    "palette search starts focused",
    await searchInput.evaluate((node) => node === document.activeElement),
  );
  check("palette groups are separate", (await page.getByText("Export & share").count()) === 1);
  const rhythm = await page.evaluate(() => {
    const groups = [...document.querySelectorAll("[cmdk-group]")].slice(0, 2);
    const box = (node: Element | null) => node!.getBoundingClientRect();
    return {
      between: Math.round(
        box(groups[1].querySelector("[cmdk-group-heading]")).top -
          box([...groups[0].querySelectorAll("[cmdk-item]")].pop() ?? null).bottom,
      ),
      inside: Math.round(
        box(groups[1].querySelector("[cmdk-item]")).top -
          box(groups[1].querySelector("[cmdk-group-heading]")).bottom,
      ),
    };
  });
  check(
    "palette separates groups from their headings",
    rhythm.between >= 12 && rhythm.inside <= 8,
    rhythm,
  );
  await searchInput.fill("export as .md");
  check("palette filters by command", (await page.locator("[cmdk-item]:visible").count()) === 1);
  check(
    "palette empty state is honest",
    !(await page.getByText("Nothing matches", { exact: false }).count()),
  );
  await searchInput.fill("no-such-command");
  check(
    "palette explains zero results",
    await page.getByText("Nothing matches", { exact: false }).isVisible(),
  );
  const paletteBox = await page.getByRole("dialog").boundingBox();
  check("palette is wide enough to scan", (paletteBox?.width ?? 0) >= 560, paletteBox);
  check("palette keyboard legend is shown", await page.getByText(/↑↓.*move/).isVisible());
  await page.keyboard.press("Escape");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("?");
  check(
    "shortcuts are discoverable",
    await page.getByRole("dialog").getByText("Shortcuts", { exact: true }).isVisible(),
  );
  check(
    "help dialog explains the mechanic",
    await page.getByText(/Type roman letters and press Space/).isVisible(),
  );
  await page.getByRole("button", { name: "Avro keymap", exact: true }).click();
  check(
    "keymap is one tap from help",
    await page.getByRole("textbox", { name: "Filter Avro keymap" }).isVisible(),
  );
  check(
    "help links to the source",
    await page.getByRole("dialog").getByRole("link", { name: "View source on GitHub" }).isVisible(),
  );
  check(
    "word frequency data is attributed",
    await page.getByRole("dialog").getByRole("link", { name: "wordfreq" }).isVisible(),
  );
  const keymapButton = page.getByTitle("Copy kh").first();
  check("keymap shows keys and glyphs", await keymapButton.isVisible());
  check("keymap shows a word example", await page.getByText("amar → আমার").first().isVisible());
  await page.getByRole("textbox", { name: "Filter Avro keymap" }).fill("kxoma");
  check("kx is documented as ক্ষ", await page.getByText("kxoma → ক্ষমা").isVisible());
  await page.getByRole("textbox", { name: "Filter Avro keymap" }).fill("");
  const allKeyRows = await page.getByTitle(/^Copy /).count();
  await page.getByRole("textbox", { name: "Filter Avro keymap" }).fill("lokkhmi");
  const filteredRows = await page.getByTitle(/^Copy /).count();
  check("keymap filter narrows the table", filteredRows > 0 && filteredRows < allKeyRows, {
    allKeyRows,
    filteredRows,
  });
  await page.getByRole("textbox", { name: "Filter Avro keymap" }).fill("nothing-matches-this");
  check(
    "keymap filter explains zero results",
    await page.getByText("No key matches", { exact: false }).isVisible(),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => typeof window.AvroPhonetic === "function", { timeout: 20000 });
  const keymapMismatches = await page.evaluate((examples) => {
    const Engine = window.AvroPhonetic;
    const engine = new Engine(
      () => ({}),
      () => {},
    );
    return examples.filter((item) => engine.suggest(item.roman).words?.[0] !== item.bangla);
  }, KEYMAP_EXAMPLES);
  check(
    "every keymap example matches the bundled engine",
    keymapMismatches.length === 0,
    keymapMismatches,
  );
  const GOLDEN_WORDS: Array<[string, string, number?]> = [
    ["amar", "আমার"],
    ["tumi", "তুমি"],
    ["kemon", "কেমন"],
    ["acho", "আছো"],
    ["bhalo", "ভালো"],
    ["somoy", "সময়"],
    ["bari", "বাড়ি"],
    ["khabo", "খাবো"],
    ["jete", "যেতে"],
    ["meye", "মেয়ে"],
    ["hridoy", "হৃদয়"],
    ["onek", "অনেক"],
    ["kichu", "কিছু"],
    ["ekhane", "এখানে"],
    ["kothay", "কোথায়"],
    ["rate", "রাতে"],
    ["kotha", "কথা"],
    ["valobasha", "ভালোবাসা"],
    ["dhonnobad", "ধন্যবাদ"],
    ["bhalobasha", "ভালোবাসা"],
    ["nei", "নেই"],
    ["hoy", "হয়"],
    ["kore", "করে"],
    ["korte", "করতে"],
    ["bolo", "বলো"],
    ["jani", "জানি"],
    ["tahole", "তাহলে"],
    ["kintu", "কিন্তু"],
    ["tai", "তাই"],
    ["jonno", "জন্য"],
    ["sathe", "সাথে"],
    ["theke", "থেকে"],
    ["upor", "উপর"],
    ["niche", "নিচে"],
    ["aj", "আজ"],
    ["kal", "কাল"],
    ["ekhon", "এখন"],
    ["tokhon", "তখন"],
    ["keno", "কেন"],
    ["kivabe", "কীভাবে"],
    ["khub", "খুব"],
    ["bhalobashi", "ভালোবাসি"],
    ["kI", "কী", 3],
    ["kkhoma", "ক্ষমা"],
  ];
  await editor.click();
  await editor.press("Control+a");
  await editor.press("Backspace");
  const goldenMisses: Array<{ roman: string; expected: string; got: string[] }> = [];
  for (const [roman, expected, maxRank = 1] of GOLDEN_WORDS) {
    await editor.pressSequentially(roman, { delay: 12 });
    await page.waitForSelector("[role=listbox]:visible", { timeout: 20000 });
    await page.waitForTimeout(160);
    const options = (await visibleOptions(page)).map((text) =>
      text.replace(/\s*(Space|as typed)$/, "").trim(),
    );
    const rank = options.indexOf(expected) + 1;
    if (rank < 1 || rank > maxRank) {
      goldenMisses.push({ roman, expected, got: options.slice(0, 4) });
    }
    await editor.press("Control+a");
    await editor.press("Backspace");
    await page.waitForTimeout(70);
  }
  check("common words rank at the top", goldenMisses.length === 0, goldenMisses);
  check(
    "accent follows the green palette, not a stray indigo",
    await page.evaluate(() => {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const hex = value.replace("#", "");
      if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
      const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
      return g >= r && g >= b;
    }),
  );
  check("no skip link in the document", (await page.locator(".skip-link").count()) === 0);
  check(
    "no 'Skip to editor' text in the document",
    (await page.getByText("Skip to editor").count()) === 0,
  );
  check(
    "draft created in IndexedDB",
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.some((entry) => entry.name === "okkhor");
    }),
  );

  await editor.click();
  await editor.pressSequentially("amar", { delay: 60 });
  await page.waitForSelector("[role=listbox]:visible", { timeout: 20000 });
  const options = await visibleOptions(page);
  check("candidates are shown", options.length > 1, options);
  check("first candidate is Bangla", /[\u0980-\u09FF]/.test(options[0] ?? ""), options[0]);
  // caretPosition appends a hidden mirror to body on the first candidate
  // render; an unpositioned absolute mirror used to add a stray scroll segment.
  check(
    "typing does not add vertical scroll",
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    })),
  );

  const activeOption = await editor.getAttribute("aria-activedescendant");
  check("editor exposes a combobox", (await editor.getAttribute("role")) === "combobox");
  check(
    "combobox announces the expanded list",
    (await editor.getAttribute("aria-expanded")) === "true",
  );
  check(
    "combobox controls the rendered listbox",
    (await editor.getAttribute("aria-controls")) ===
      (await page.locator("[role=listbox]:visible").getAttribute("id")),
  );
  check(
    "active descendant is the selected option",
    Boolean(activeOption) &&
      (await page.locator(`#${activeOption}`).getAttribute("aria-selected")) === "true",
    activeOption,
  );
  const selectedText = () =>
    page.evaluate(
      () => document.querySelector('[role=option][aria-selected="true"]')?.textContent ?? "",
    );
  for (let i = 0; i < 6 && !(await selectedText()).includes("as typed"); i += 1) {
    await editor.press("ArrowDown");
  }
  await page.waitForTimeout(150);
  const asTyped = await page.evaluate(() => {
    const row = document.querySelector('[role=option][aria-selected="true"]');
    return {
      ok:
        Boolean(row?.textContent?.includes("as typed")) &&
        getComputedStyle(row!).color === "rgb(251, 251, 249)",
      text: row?.textContent,
      color: row ? getComputedStyle(row).color : null,
    };
  });
  check("the as-typed row stays readable when selected", asTyped.ok, asTyped);
  for (let i = 0; i < 6 && !(await selectedText()).includes("আমার"); i += 1) {
    await editor.press("ArrowUp");
  }
  check(
    "candidate option ids are unique",
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[role=option]")].map((node) => node.id);
      return ids.length > 1 && new Set(ids).size === ids.length;
    }),
  );
  check(
    "candidate popup animates in",
    (await page
      .locator(".candidate-pop")
      .evaluate((node) => getComputedStyle(node).animationName)) !== "none",
  );

  await editor.press("Tab");
  check(
    "Tab commits a candidate",
    (await editor.inputValue()).includes("আমার"),
    await editor.inputValue(),
  );

  await clearEditor(editor);
  await editor.pressSequentially("ami", { delay: 60 });
  await page.waitForSelector("[role=listbox]:visible", { timeout: 20000 });
  await editor.press("Space");
  check(
    "Space commits a candidate",
    (await editor.inputValue()) === "আমি ",
    await editor.inputValue(),
  );
  check(
    "committed word is announced",
    /Committed\s+আমি/.test((await page.getByRole("status").innerText()).trim()),
    await page.getByRole("status").innerText(),
  );
  check(
    "intro retires after the first commit",
    (await page.getByText("Type roman letters. Press Space to choose a Bangla word.").count()) ===
      0,
  );
  await page.waitForTimeout(200);
  check("save state is reported", await page.getByText("Saved", { exact: true }).isVisible());

  await clearEditor(editor);
  await editor.pressSequentially("amar bhalo ", { delay: 60 });
  const multiWord = await editor.inputValue();
  check("each roman word converts on Space", multiWord === "আমার ভালো ", multiWord);

  await clearEditor(editor);
  await editor.pressSequentially("tumi.", { delay: 60 });
  check(
    "punctuation commits a word",
    (await editor.inputValue()) === "তুমি.",
    await editor.inputValue(),
  );

  const languageSwitch = page.getByRole("switch", { name: "Toggle Bangla and English input" });
  check(
    "Bangla mode is marked active",
    (await languageSwitch.getAttribute("aria-checked")) === "true",
  );
  const modeLabels = (await languageSwitch.innerText()).replace(/\s+/g, " ");
  check(
    "mode switch shows both labels",
    modeLabels.includes("বাং") && modeLabels.includes("EN"),
    modeLabels,
  );

  const themeButton = page.getByRole("button", { name: "Change theme" });
  check(
    "theme icon starts with the resolved theme",
    /lucide-sun/.test((await themeButton.locator("svg").getAttribute("class")) ?? ""),
  );
  await themeButton.click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await page.waitForTimeout(200);
  check(
    "dark theme is applied",
    ((await page.locator("html").getAttribute("class")) ?? "").includes("dark"),
  );
  check(
    "theme icon follows dark mode",
    /lucide-moon/.test((await themeButton.locator("svg").getAttribute("class")) ?? ""),
  );
  const darkAction = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const action = [...document.querySelectorAll("button")].find((node) =>
      node.textContent?.includes("New document"),
    );
    const rgb = action
      ? (getComputedStyle(action).backgroundColor.match(/\d+/g) ?? []).slice(0, 3).map(Number)
      : [];
    return {
      solid: root.getPropertyValue("--solid").trim(),
      primary: root.getPropertyValue("--primary").trim(),
      rgb,
      bone: rgb.length === 3 && rgb.every((channel) => channel > 200),
    };
  });
  check("dark primary action is bone, not crimson", darkAction.bone, darkAction);
  await themeButton.click();
  await page.getByRole("menuitem", { name: "Light" }).click();
  check(
    "light theme is applied",
    ((await page.locator("html").getAttribute("class")) ?? "").includes("light"),
  );

  await page
    .getByRole("button", { name: /^Delete / })
    .first()
    .click();
  check(
    "delete confirmation is an in-page dialog",
    await page.getByRole("alertdialog").isVisible(),
  );
  check(
    "delete confirmation names the draft",
    (await page.getByRole("alertdialog").innerText()).includes("“"),
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  check("cancel keeps the draft", (await page.locator("#editor").count()) === 1);

  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#editor", { timeout: 20000 });
  check("draft survives reload", (await page.locator("#editor").inputValue()) === "তুমি.");

  await languageSwitch.click();
  check(
    "English mode is marked active",
    (await languageSwitch.getAttribute("aria-checked")) === "false",
  );
  check(
    "editor language is English",
    (await page.locator("#editor").getAttribute("lang")) === "en",
  );
  const englishEditor = page.locator("#editor");
  await clearEditor(englishEditor);
  await englishEditor.pressSequentially("ami bhalo", { delay: 40 });
  const passthrough = await englishEditor.inputValue();
  check("English mode passes banglish through", passthrough === "ami bhalo", passthrough);
  check(
    "no candidates in English mode",
    (await page.locator("[role=listbox]:visible").count()) === 0,
  );
  await context.close();

  const historyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const historyPage = await historyContext.newPage();
  await openEditor(historyPage);
  await historyPage.evaluate(() => localStorage.setItem("okkhor-words", JSON.stringify({ ভাল: 3 })));
  await historyPage.reload({ waitUntil: "domcontentloaded" });
  await historyPage.waitForSelector("#editor", { timeout: 20000 });
  await historyPage.waitForFunction(() => typeof window.AvroPhonetic === "function", {
    timeout: 20000,
  });
  const historyEditor = historyPage.locator("#editor");
  await clearEditor(historyEditor);
  await historyEditor.pressSequentially("ami", { delay: 60 });
  await historyPage.waitForSelector("[role=listbox]:visible", { timeout: 20000 });
  const historyTop = (await visibleOptions(historyPage))[0] ?? "";
  check("history cannot hijack the candidate list", historyTop.includes("আমি"), historyTop);
  await historyContext.close();

  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reduced.newPage();
  const reducedEditor = await openEditor(reducedPage);
  await reducedEditor.click();
  await reducedEditor.pressSequentially("amar", { delay: 40 });
  await reducedPage.waitForSelector("[role=listbox]:visible", { timeout: 20000 });
  const reducedDuration = await reducedPage
    .locator(".candidate-pop")
    .evaluate((node) => getComputedStyle(node).animationDuration);
  check(
    "reduced motion removes candidate movement",
    parseFloat(reducedDuration) <= 0.001,
    reducedDuration,
  );
  await reduced.close();

  const clipContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const clipPage = await clipContext.newPage();
  const clipEditor = await openEditor(clipPage);
  const headerCopy = clipPage.locator("header").getByRole("button", { name: "Copy everything" });
  await headerCopy.click();
  await clipPage.getByText("Nothing to copy yet").waitFor();
  check(
    "copy everything on an empty draft says so",
    await clipPage.getByText("Nothing to copy yet").isVisible(),
  );
  const sample = "Whole draft fence line.";
  await clipEditor.fill(sample);
  // The draft title auto-syncs from the first line, so the header-scoped
  // locator stays unique against the library card controls. A sample that
  // does not start with "Copy everything" also keeps the palette query
  // matching only the command, not the draft.
  await headerCopy.click();
  await clipPage.waitForTimeout(300);
  const clippedHeader = await clipPage.evaluate(() => navigator.clipboard.readText());
  check("header copy copies the whole draft", clippedHeader === sample, clippedHeader);
  await clipPage.getByRole("button", { name: "Document actions" }).click();
  await clipPage.getByRole("menuitem", { name: "Copy everything" }).click();
  await clipPage.waitForTimeout(300);
  const clippedMenu = await clipPage.evaluate(() => navigator.clipboard.readText());
  check("document menu copy copies the whole draft", clippedMenu === sample, clippedMenu);
  await clipPage.keyboard.press("Escape");
  await clipPage.keyboard.press("Control+k");
  await clipPage.getByPlaceholder("Search drafts and commands…").fill("copy everything");
  await clipPage.keyboard.press("Enter");
  await clipPage.waitForTimeout(300);
  const clippedPalette = await clipPage.evaluate(() => navigator.clipboard.readText());
  check("palette copy copies the whole draft", clippedPalette === sample, clippedPalette);
  await clipContext.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobile.newPage();
  await openEditor(mobilePage);
  check("mobile editor is visible", await mobilePage.isVisible("#editor"));
  check(
    "GitHub icon stays out of the phone header",
    !(await mobilePage
      .locator("header")
      .getByRole("link", { name: "View source on GitHub" })
      .isVisible()),
  );
  await mobilePage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await mobilePage.keyboard.press("?");
  const closeBox = await mobilePage.getByRole("button", { name: "Close" }).boundingBox();
  check("dialog close target is at least 44px on touch", (closeBox?.height ?? 0) >= 44, closeBox);
  check(
    "help opens without focusing a tab",
    await mobilePage.evaluate(() => document.activeElement?.getAttribute("aria-pressed") === null),
  );
  await mobilePage.keyboard.press("Escape");
  const teaching = await mobilePage.evaluate(() => {
    const hint = document.querySelector("#editor-hint")!.getBoundingClientRect();
    const chip = [...document.querySelectorAll("button")]
      .find((node) => node.textContent?.includes("ami"))
      ?.getBoundingClientRect();
    return {
      gap: chip ? Math.round(chip.top - hint.bottom) : null,
      hintBottom: Math.round(hint.bottom),
    };
  });
  check("first-run examples sit under the prompt", (teaching.gap ?? 999) <= 120, teaching);
  const titleWidth = (await mobilePage.getByRole("textbox", { name: "Draft title" }).boundingBox())
    ?.width;
  check("draft title is legible on a phone", (titleWidth ?? 0) >= 120, titleWidth);
  const touchTargets = await mobilePage.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((node) => node.getBoundingClientRect().height > 0)
      .map((node) => ({
        name: node.getAttribute("aria-label") ?? node.textContent?.trim().slice(0, 20),
        h: Math.round(node.getBoundingClientRect().height),
      })),
  );
  check(
    "touch controls are at least 44px",
    touchTargets.every((target) => (target.h ?? 0) >= 44),
    touchTargets,
  );
  check(
    "no text below the 12px floor",
    await mobilePage.evaluate(() => {
      const nodes = [...document.querySelectorAll("body *")].filter((el) => {
        const s = getComputedStyle(el);
        return (
          s.display !== "none" &&
          s.visibility !== "hidden" &&
          [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
        );
      });
      return nodes.every((el) => parseFloat(getComputedStyle(el).fontSize) >= 12);
    }),
  );
  await mobilePage.locator("#editor").click();
  await mobilePage.keyboard.type("ami");
  await mobilePage.waitForSelector("[role=listbox]:visible", { timeout: 20000 });
  const strip = await mobilePage.locator('[role="listbox"]').evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hint = document.querySelector("#editor-hint")!.getBoundingClientRect();
    return {
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      hintBottom: Math.round(hint.bottom),
      vh: innerHeight,
    };
  });
  check("candidate strip sits at the bottom on phones", strip.bottom >= strip.vh - 1, strip);
  check("candidate strip never covers the hint", strip.top >= strip.hintBottom, strip);
  await mobilePage.getByRole("button", { name: "Open drafts" }).click();
  await mobilePage.waitForTimeout(300);
  const mobileDelete = mobilePage.getByRole("button", { name: /^Delete / }).first();
  check("delete is reachable on touch", await mobileDelete.isVisible());
  const deleteBox = await mobileDelete.boundingBox();
  check("touch delete target is at least 44px", (deleteBox?.height ?? 0) >= 44, deleteBox);
  check(
    "no horizontal overflow on mobile",
    await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await mobilePage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    })),
  );
  await mobile.close();

  const measure = async (width: number, height: number) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await openEditor(page);
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const editor = document.querySelector("#editor")!;
      const card = editor.parentElement!;
      const menu = document.querySelector('[aria-label="Open drafts"]');
      const aside = document.querySelector("aside");
      return {
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
        editor: Math.round(editor.getBoundingClientRect().width),
        card: Math.round(card.getBoundingClientRect().width),
        title: Math.round(
          document.querySelector('[aria-label="Draft title"]')!.getBoundingClientRect().width,
        ),
        menu: Boolean(menu && menu.getBoundingClientRect().height > 0),
        aside: Boolean(aside && getComputedStyle(aside).display !== "none"),
      };
    });
    await context.close();
    return result;
  };

  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
    [844, 390],
  ]) {
    const size = await measure(width, height);
    check(`${width}x${height} has no horizontal overflow`, size.x === 0, size);
  }

  const small = await measure(320, 568);
  check("320px keeps the draft title readable", small.title >= 90, small);
  check("320px writing surface fits the viewport", small.y === 0, small);

  const tablet = await measure(768, 1024);
  check("tablet portrait keeps the drafts in a sheet", tablet.menu && !tablet.aside, tablet);
  check("tablet portrait has a usable writing column", tablet.editor >= 600, tablet);

  const desktop = await measure(1920, 1080);
  check("large screens grow the paper surface", desktop.card >= 700, desktop);
  check("large screens keep the measure capped", desktop.editor <= 900, desktop);
  check("large screens show the sidebar", desktop.aside && !desktop.menu, desktop);

  const landscape = await measure(844, 390);
  check("phone landscape fits without page scroll", landscape.y === 0, landscape);

  const zoomed = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const zoomPage = await zoomed.newPage();
  await openEditor(zoomPage);
  await zoomPage.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await zoomPage.waitForTimeout(200);
  check(
    "200% text does not break the phone layout",
    await zoomPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await zoomed.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("\nAll E2E checks passed.");
