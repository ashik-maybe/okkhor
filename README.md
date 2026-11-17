# Okkhor

A private, offline Bangla writing studio. Type roman letters and choose Bangla words from a ranked candidate strip. Everything stays in the browser.

Live: https://ashik-maybe.github.io/okkhor/

## What is in the MVP

- React 19, Vite 7, TypeScript, Tailwind CSS v4, shadcn/ui.
- The original 2013 Avro phonetic engine, loaded lazily as a classic script.
- A modern alias layer: common tech and loanwords map to canonical Bangla spellings.
- Candidate ranking from aliases and personal word history.
- Unlimited drafts in IndexedDB, with autosave, search, rename and delete.
- One-time import of the five old `draft-0`…`draft-4` localStorage drafts.
- Export to `.txt`, `.md`, `.html`, plus a JSON backup and file import.
- Light, dark and system themes.
- Command palette (`Ctrl/Cmd+K`), `Ctrl+.` language toggle, and a mobile candidate rail above the keyboard.
- Installable PWA with an offline shell. The 3.8 MB engine is cached at runtime, not precached.

## Layout

```
index.html                 app entry and theme bootstrap
src/main.tsx               React root
src/App.tsx                workspace shell and wiring
src/features/editor/       textarea, caret positioning, candidate keys
src/features/candidates/   floating list and mobile candidate strip
src/features/library/      draft list and search
src/features/command/      command palette
src/lib/avro-service.ts    engine loader, token extraction and ranking
src/lib/documents.ts       IndexedDB documents and legacy migration
src/lib/db.ts              Dexie schema
src/data/modern-aliases.ts curated roman → Bangla aliases
src/engine/avro.min.js     unmodified 2013 phonetic engine and dictionary
tests/unit.test.ts         Vitest checks
tests/e2e.ts               Playwright smoke checks
```

## Brand

The app mark is a lac-red squircle with the Bengali letter অ cut out as negative space. The glyph outline is derived from Noto Sans Bengali (SIL Open Font License). Editable masters live in `public/images/logo.svg`, `logo-dark.svg`, and `logo-mono.svg`; the favicon, touch icon, PWA icons, and social card are generated from the light master.

## Input, motion and performance

The textarea is a combobox: it owns the active suggestion through `aria-activedescendant`, and committed words are announced in a polite live region. Motion uses shared easing and duration tokens, stays on compositor properties, and collapses under `prefers-reduced-motion`. The 3.9 MB phonetic dictionary and a 52 KB word-frequency table load after first paint or on editor focus, and the command palette and vendor code are split into cacheable chunks. Frequency only re-ranks candidates the engine already produced; it never replaces the dictionary.

## Develop

```bash
bun install
bun run dev
```

## Verify

```bash
bun run typecheck
bun run lint          # oxlint, stock defaults
bun run format:check  # oxfmt, stock defaults
bun run test
bun run build
bun run preview --port 4173
bun run test:e2e
```

`BASE=https://ashik-maybe.github.io/okkhor/ bun run test:e2e` targets the live site.

## Deploy

Push to `main`. The workflow typechecks, lints, checks formatting, runs unit and browser tests, builds, and publishes `dist/` to GitHub Pages. Set Pages source to **GitHub Actions** and allow `main` in the `github-pages` environment.

## Licensing

`src/engine/avro.min.js` is the original OmicronLab 2013 engine and remains under MPL-1.1. `src/data/word-frequency.tsv` is derived from wordfreq's Bengali data and is licensed CC BY-SA 4.0; see `public/licenses/wordfreq.md` and regenerate it with `python3 scripts/build-word-frequency.py`. The alias data and new application code are original work. A repository-level license has not been chosen yet.
