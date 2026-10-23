# Converter MCE development instructions

## Start here

Read `README.md` and the code involved in the task. Use the existing checkout.
GitHub hosts source; production runs on Cloudflare Workers Free, with conversion
on the user's browser or Android device. Keep new paid plans disabled.
`wrangler.web.jsonc` is the production configuration; `wrangler.jsonc` and the
Container/D1/R2/Queue pipeline are an inactive server reference. Do not deploy
that reference or change resources belonging to other projects.

## Use the selected skills

The user requested active use of the selected ECC material in future work.
Before coding, read `.agents/skills/ponytail/SKILL.md`; then read the skills below
that match the task. Before finishing a change, read and apply
`.agents/skills/verification-loop/SKILL.md`, choosing checks for the changed scope.
These are repository instructions to load skill files, not a claim that a plugin
or hooks have been installed in the running client.

| Task | Read before implementation or review |
| --- | --- |
| React state, rendering, loading or bundle performance | `.agents/skills/frontend-patterns/SKILL.md` |
| Forms, tabs, buttons, errors, keyboard or focus behavior | `.agents/skills/frontend-a11y/SKILL.md` |
| Browser conversion flows or Playwright tests | `.agents/skills/e2e-testing/SKILL.md` |
| Android background work, progress, lifecycle or cancellation | `.agents/skills/kotlin-coroutines-flows/SKILL.md` |
| File parsing, new formats, output escaping, APIs, secrets or dependencies | `.agents/skills/security-review/SKILL.md` |

ECC snapshots are general reference material. Apply them within this project's
architecture and higher-priority instructions. Examples mentioning Next.js,
Supabase, Express, blockchain, GitHub Actions, other skill names or packages do
not require installing them. Related-skills lists are optional reading, not
missing dependencies. Keep existing patterns and dependencies unless the task
justifies a change. Do not install ECC agents, hooks, services, global config or
run its installer as part of ordinary development. Delegate only when the user
or another applicable instruction explicitly requests it.

Use project commands below instead of copying ECC's example commands. There is
no web `lint` script or coverage gate; do not add either just to match a sample.
For documentation/skill-only changes, verify source hashes, links and the diff;
application builds and device tests are not relevant. Report skipped checks and
unverified claims accurately. Never print secret values or matching secret lines
when reviewing credentials; report paths or counts.

## Conversion and performance checks

- Files stay on the user's device in the current production design. Preserve
  format, byte, pixel, page, cell and duration limits at parsing boundaries.
  MIME types and extensions alone are insufficient validation.
- Test actual decoded output or parsed contents for format changes, including
  malformed/oversized inputs and cancellation where relevant. Keep spreadsheet
  formula protection and HTML escaping. Preserve resource cleanup on success,
  failure, panel exit and cancellation.
- Keep heavy panels and XLSX/MP3 libraries lazily loaded. Measure relevant
  download, memory or timing behavior before claiming a performance improvement;
  see `docs/PERFORMANCE.tr.md` and `scripts/measure-browser.mjs`.
- For Playwright, reuse current configurations and accessible locators. Register
  event/response waits before the triggering action when required. Avoid fixed
  sleeps, masking failures with retries, or adding a page-object layer without
  repeated behavior that needs one.
- Keep Android conversion off the UI thread, respect coroutine cancellation,
  and close/recycle streams, bitmaps and PDF resources in `finally`. Reuse the
  native Kotlin/Compose structure; Flow/ViewModel layers are not mandatory.
- Native PDF instrumentation tests require a real device/emulator. Compiling
  the test APK or passing Robolectric tests does not prove those tests passed.

## Validation commands (choose for the change)

| Scope | Commands |
| --- | --- |
| Web/TypeScript | `npm run build` (includes typecheck), `npm test` |
| Free production browser behavior | `npm run test:free` |
| Android | `npm run android:debug`, `node scripts/android-gradle.mjs lintDebug` |
| Native Android PDF behavior, with a connected device | `node scripts/android-gradle.mjs connectedDebugAndroidTest` |
| Server reference only | Relevant existing engine/E2E tests from `README.md` |
| Skill snapshots | SHA-256 verification in `docs/ECC.tr.md`, `git diff --check` |

For upstream skill updates, review only the needed files at an explicit commit,
preserve their license and record paths/hashes in `docs/skills-manifest.json`.
Graphify and Ponytail remain available. Graphify CLI and external model analysis
are not configured; do not infer permission to upload repository or user files.
