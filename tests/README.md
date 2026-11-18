# Tests

Unit tests use Vitest; browser smoke checks use Playwright.

```sh
bun run test
bun run build
bun run preview --port 4173   # terminal 1
bun run test:e2e              # terminal 2
```

The default browser target is `http://localhost:4173/`. Override it with `BASE`:

```sh
BASE=https://okkhor.asf.run/ bun run test:e2e
```

`tests/corpus.json` is kept from the original engine as a future ranking fixture. The current e2e suite checks editor load, IndexedDB persistence, candidate selection, commit, reload, language toggle, and a mobile viewport with no horizontal overflow.
