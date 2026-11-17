// Playwright smoke checks for the Okkhor MVP.
// Start `bun run preview --port 4173` first, then run `bun run test:e2e`.

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4173/okkhor/";
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures.push(detail === undefined ? name : `${name}: ${JSON.stringify(detail)}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#editor", { timeout: 20000 });

  check("editor is visible", await page.isVisible("#editor"));
  check(
    "draft created in IndexedDB",
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.some((entry) => entry.name === "okkhor");
    }),
  );

  const editor = page.locator("#editor");
  await editor.click();
  await editor.pressSequentially("amar", { delay: 80 });
  await page.waitForSelector("[role=listbox]", { timeout: 20000 });
  const options = await page.locator("[role=option]").allInnerTexts();
  check("candidates are shown", options.length > 1, options);
  check("first candidate is Bangla", /[\u0980-\u09FF]/.test(options[0] ?? ""), options[0]);

  await editor.press("Tab");
  await page.waitForTimeout(200);
  const committed = await editor.inputValue();
  check("Tab commits a candidate", committed.includes("আমার"), committed);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#editor", { timeout: 20000 });
  check("draft survives reload", (await page.locator("#editor").inputValue()).includes("আমার"));

  const languageSwitch = page.getByRole("switch", { name: "Toggle Bangla and English input" });
  await languageSwitch.click();
  check(
    "language toggle changes editor language",
    (await page.locator("#editor").getAttribute("lang")) === "en",
  );

  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForSelector("#editor", { timeout: 20000 });
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
