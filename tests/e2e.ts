// Playwright smoke checks for the Okkhor editor.
// Start `bun run preview --port 4173` first, then run `bun run test:e2e`.

import { chromium, type Locator, type Page } from "playwright";

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

  await clearEditor(editor);
  await editor.pressSequentially("amar bhalo ", { delay: 60 });
  const multiWord = await editor.inputValue();
  check("each roman word converts on Space", multiWord === "আমার ভাল ", multiWord);

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
  check(
    "dark theme is applied",
    ((await page.locator("html").getAttribute("class")) ?? "").includes("dark"),
  );
  check(
    "theme icon follows dark mode",
    /lucide-moon/.test((await themeButton.locator("svg").getAttribute("class")) ?? ""),
  );
  await themeButton.click();
  await page.getByRole("menuitem", { name: "Light" }).click();
  check(
    "light theme is applied",
    ((await page.locator("html").getAttribute("class")) ?? "").includes("light"),
  );

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
    "no horizontal overflow on mobile",
    await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await mobilePage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    })),
  );
  await mobile.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("\nAll E2E checks passed.");
