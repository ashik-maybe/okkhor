# Okkhor

**A private, offline Bangla writing studio for the browser.** Type roman letters, get Bangla words — your writing never leaves your device.

- **Live:** https://okkhor.asf.run/
- **GitHub Pages (alias, redirects to the live site):** https://ashik-maybe.github.io/okkhor/
- **Source:** https://github.com/ashik-maybe/okkhor
- **License:** MIT

## Why Okkhor

Okkhor is built for writing Bangla comfortably on a phone or laptop without installing a keyboard or creating an account. It runs entirely in the browser: the Avro Phonetic engine converts roman (Latin) letters into Bangla words as you type, and everything is stored locally with IndexedDB. There is no server, no signup, and no tracking.

## Features

- **Avro Phonetic typing** — the same layout as Avro Keyboard. Type `amar`, press Space, and `আমার` is committed.
- **Smart candidates** — a ranked suggestion strip (desktop) and a bottom candidate bar (phones), with arrow-key navigation and tap-to-commit.
- **Multi-draft library** — auto-saving drafts with titles, timestamps, and a searchable sidebar.
- **Personal word learning** — words you commit are remembered and ranked higher next time.
- **Bangla / English toggle** — switch modes in one tap (`Ctrl + .`).
- **Copy everything** — one-tap copy of the whole draft from the header (next to the toggler on phones), the Document actions menu, or the command palette (`Ctrl + K`).
- **Export** — `.txt`, `.md`, `.html`, plus a full JSON backup and restore (Import file).
- **Draft management** — delete a single draft or all drafts at once (with confirmation), clear personal words.
- **Command palette** — `Ctrl + K` for every action, including theme and draft switching.
- **Themes** — light, dark, or system.
- **Offline PWA** — installs like an app, works with no network after the first visit.
- **Privacy-first** — no accounts, no analytics, no servers. Clearing browser data removes everything.
- **Accessible** — 44px touch targets, reduced-motion support, keyboard-first.

## How it works

1. Type roman letters — Okkhor uses the Avro Phonetic layout.
2. Pick a word from the suggestion list with `↑` / `↓`, or press `Space` to accept the top choice.
3. Keep writing — every word is saved on your device as you go.

Example: type `amar`, press Space, and **আমার** appears.

## Install

On Android or iOS, open the site and use your browser's **Add to Home Screen** / **Install app**. On desktop, use the install icon in the address bar. After that Okkhor opens like any other app and works offline.

## Keyboard shortcuts

| Keys       | Action                            |
| ---------- | --------------------------------- |
| `Space`    | Commit the selected Bangla word   |
| `↑` / `↓`  | Move between suggestions          |
| `Esc`      | Dismiss suggestions               |
| `Ctrl + K` | Open the command palette          |
| `Ctrl + .` | Switch between Bangla and English |
| `?`        | Show the shortcut list            |

## Privacy

Okkhor has no accounts and no servers. Nothing you write is sent anywhere; drafts are stored in your browser (IndexedDB / local storage). Clearing browser data removes them — use **Download backup** before that if you want to keep them. Personal words are stored separately and can be cleared from Document actions.

## Development

```sh
bun install
bun run dev            # dev server
bun run build          # typecheck + vite build
bun run preview        # preview the built site (port 4173)
bun run typecheck      # tsc --noEmit
bun run lint           # oxlint
bun run format         # oxfmt --write .
bun run format:check   # oxfmt --check .
bun run test           # vitest (unit)
bun run test:e2e       # Playwright against the preview (default http://localhost:4173/)
```

End-to-end tests need the preview running first (`bun run preview --port 4173`), or let the workflow do it. Override the target with `BASE`:

```sh
BASE=https://okkhor.asf.run/ bun run test:e2e
```

## Deploy

Push to `main`. The workflow typechecks, lints, checks formatting, runs unit and browser tests, builds, and publishes `dist/` to GitHub Pages (source set to **GitHub Actions**). The custom domain is recorded in `CNAME` and configured in the repo's Pages settings; `https://ashik-maybe.github.io/okkhor/` keeps working as a redirect to the custom domain.

## Tech stack

- React 19, Vite 7, TypeScript, Tailwind CSS v4, shadcn/ui
- Dexie (IndexedDB) for drafts and settings
- vite-plugin-pwa for offline installability
- Fonts: Tiro Bangla, Noto Sans Bengali, Anek Bangla (variable)
- The original 2013 Avro phonetic engine, loaded lazily as a classic script

## Credits

- Avro Phonetic engine: OmicronLab (https://www.omicronlab.com/) — the same layout used by Avro Keyboard.
- Built as a modern, offline, privacy-first take on that engine.
