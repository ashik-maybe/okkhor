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
  check("brand appears once", (await page.getByText("অক্ষর", { exact: true }).count()) === 1);
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
    "document menu can clear personal words",
    await page.getByRole("menuitem", { name: "Clear personal words" }).isVisible(),
  );
  await page.keyboard.press("Escape");
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
  check("save state is reported", await page.getByText("Saved locally").isVisible());

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

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobile.newPage();
  await openEditor(mobilePage);
  check("mobile editor is visible", await mobilePage.isVisible("#editor"));
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
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("\nAll E2E checks passed.");
