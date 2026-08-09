# Canvas Connections Stability Baseline

Recorded on 2026-08-09 after aborting the unfinished merge on local `main` and
switching to clean commit `cb14fca` on `desktop-v2`.

- Pack merge preservation fix `5f0072c` is present.
- `npm run test:logic`: 141/141 passed.
- `npm run build:web`: passed; main chunk 997.64 kB (281.73 kB gzip).
- `npm run lint`: 6 errors and 21 warnings.
  - Three errors are in the experimental canvas connection implementation.
  - Three errors are existing DesktopApp React memoization dependency findings.
- `git diff --check`: clean before implementation.

The aborted conflict version of `src/pages/DesktopApp.jsx` was not merged or
used as an implementation source.
