# PLAN (budget ~3h)

| # | Phase | Depends on | Time |
|---|-------|-----------|------|
| 0 | Initialization (CLAUDE/PLAN/WORKLOG, env check, log plan) | — | 10 min |
| 1 | Candidate manually explores booking flow with prescription (login -> payment handoff) | 0 | 15 min |
| 2 | Setup: approved `git init`, `npm init`, install Playwright + TS, `.env.example`, config | 0, approval | 10 min |
| 3 | Task 1: implement `initial_surname_test.spec.ts` + one extra test; run; mutation check that tests fail when behavior breaks | 1, 2 | 40 min |
| 4 | Task 2: candidate creates synthetic account, explores "Wizyta zdalna", records bugs | 0 | 40 min |
| 5 | Regression test for one confirmed bug (`test.fail()` / `@known-bug`), README | 3, 4 | 20 min |
| 6 | Report in Google Docs (bugs, approach, not-tested, automation levels, improvements, "Praca z agentem") — only after approval | 4, 5 | 25 min |
| 7 | Cleanup: cancel reserved consultations, secrets check, export + verify session log (format, size, redaction), submit (candidate) | all | 10 min |

Total ≈ 170 min. Priority if time runs short: Task 1 main test > bug reports > regression design > extras.

## Confirmed manual observations (candidate-reported, not yet automated)
- Summary page, paid button "Umów za 59.00 PLN": same-tab redirect to PayU (host not yet known). Click creates a consultation.
- With 0 consents selected: paid button enabled; click shows red validation message; no navigation.
- After clicking "Zaznacz wszystkie" then manually unchecking ONE individual consent: the other two stay checked. The select-all control's resulting state is UNKNOWN (do not assume unchecked/indeterminate).
- Created consultation appears on the main page in a "Wkrótce" section with badge "Nieopłacona" and buttons "Anuluj" and "Opłać"; it lists type "Lekarz ogólny - Konsultacja z receptą", date, and "Wybrane leki" (screenshot shows "Aulin 100 mg 3 sasz. 2 g", a drug not chosen in our Duomox flow, so it may be a different/older booking).

## Test-environment / test-data isolation limitation (candidate-confirmed)
- The "Aulin 100 mg" consultation seen on the main page is the candidate's own, created in an earlier manual interaction; it is NOT the Duomox consultation of the planned main test. (Corrects the earlier note that it "may be a different/older booking".)
- The shared account may hold pre-existing consultations from earlier manual exploration or other users. A visible consultation must never be assumed to belong to the current run.
- Rule: automation must not cancel a consultation unless it can reliably identify it as created by that specific run. If ownership is uncertain, clean up manually and document the uncertainty; never risk cancelling an unrelated one.
- Report material: mention as a test-isolation observation with recommendation (e.g. per-run unique data or a test-only API/cleanup hook, a dedicated account per run, a visible booking ID/reference on the card, and a test-data reset endpoint).

## Proposed minimal manual consent checks (candidate performs; none complete a booking)
Bit order c1 c2 c3 = top-to-bottom consents on the summary page. Known: 000 -> red validation message, no navigation (confirmed). Hypothesis (unverified): all three are mandatory (each has `*`).
Safety: only submit with INCOMPLETE consents (no booking is created). Never submit with 111 manually here; the 111 happy path belongs to the main test.

| # | Check | Steps | Record | Expected value |
|---|-------|-------|--------|----------------|
| M1 | c1 required | check c2+c3 only (011), click paid button | message text, URL unchanged | proves c1 necessary |
| M2 | c2 required | 101, click paid button | same | proves c2 necessary |
| M3 | c3 required | 110, click paid button | same | proves c3 necessary |
| M4 | select-all from empty | from 000 click "Zaznacz wszystkie" | state of c1-c3 and of select-all | S1 |
| M5 | select-all, uncheck one | from M4 uncheck one consent | state of select-all (checked / unchecked / indeterminate), other two | closes the unknown from candidate's finding |
| M6 | select-all clicked again in partial state | from M5 click select-all | resulting state of all 4 controls | completes partial-state semantics |
| M7 | select-all toggle off | with all 3 checked click select-all | do all 3 uncheck? | decides if toggle-off is supported |
| M8 | no bypass | from M5 (2 of 3 checked, select-all in whatever state) click paid button | message, URL unchanged | validation follows the 3 real consents, not select-all |

Rationale for scope: leave-one-out (M1-M3, 011/101/110) plus the known 000 shows every consent is necessary given that 111 succeeds in the main test. Single-only cases (100, 010, 001) are redundant for that claim and are skipped; revisit only if M1-M3 show anything unexpected. Mind the PayU boundary: M1-M3 and M8 must never reach PayU; if one does, stop and tell me (a booking would then exist and must be cancelled, only if ownership is certain).
Note: M1-M3 and M8 also cover goal "incomplete consents consistently prevent navigation" (4 independent incomplete states + the known 000). Consistency across repeated clicks is covered by clicking the button twice once in M1.
Mapping to later automation (proposal): parameterised validation test over 000/011/101/110; one select-all test combining M4-M7 assertions per verified behavior.

## Manual consent check results (candidate-reported)
Bit order c1 c2 c3 (top to bottom). All incomplete selections showed a validation message and did NOT navigate to PayU.

| Case | Result |
|------|--------|
| 000 (earlier) | PASS |
| M1 (011) | PASS |
| M2 (101) | PASS |
| M3 (110) | PASS |
| M4 select-all from 000 | PASS: all three selected |
| M5 uncheck one after select-all | PASS: other two stay selected |
| M6 select-all from partial | PASS: selects all three |
| M7 select-all from 111 | PASS: deselects all three |
| M8 submit with incomplete consents | PASS: validation, no navigation |

Notes: each of the three consents is therefore confirmed required (leave-one-out). "Zaznacz wszystkie" supports select and deselect. Exact validation text was not recorded; do not assert on invented text (assert on a visible validation message element after verifying it in the DOM). The visual state of the select-all control itself after one consent is unchecked was not reported: still UNKNOWN. The earlier ambiguous message observation is not a bug.

## Revised automated test scope (fits ~3h budget)
File: `k_kielb_test.spec.ts`. Stop at PayU handoff; no payment data ever.
1. MAIN (required, E2E happy path): login -> Umów się -> Recepta -> Ból ucha -> Duomox -> summary assertions -> select 3 consents -> "Umów za 59.00 PLN" -> assert redirect to PayU (host verified before asserting) -> stop. Creates a booking; run sparingly.
2. ADDITIONAL (required, one sentence): parameterised consent validation over 000, 011, 101, 110 (covers every consent being required; 100/010/001 skipped as redundant) — "Proves each required consent blocks booking: with any consent missing, a validation message shows and the browser stays on Telemedi (no PayU handoff, no booking created)."
3. OPTIONAL if time remains: one "Zaznacz wszystkie" test: 000 -> select-all => 3 checked; one consent unchecked then select-all => 3 checked; select-all again from 111 => 0 checked. Does not assert the select-all control's own state after unchecking one (unknown).
Not automated: cancellation (manual). Cleanup rule stays: NEVER cancel a consultation unless it can be reliably identified as created by that specific run; otherwise cancel manually and document. Pre-existing consultations (e.g. the candidate's Aulin one) must not be touched.
Still unknown before coding: PayU host/URL, validation message DOM/role, locators (verify against real DOM with candidate approval).

## Setup done (2026-10-16)
- Files: `package.json` (scripts: test, test:headed, install:browsers, typecheck), `playwright.config.ts` (baseURL from `TELEMEDI_BASE_URL`, workers=1, trace/screenshot on failure, dotenv), `tsconfig.json`, `.gitignore` (node_modules, .env, reports), `.env.example` (placeholders), local `.env` (copy of the example, still placeholders; gitignored).
- Dev deps only: `@playwright/test` 1.64.1, `typescript` 7.0.2, `@types/node`, `dotenv`. Chromium installed via Playwright. `npx tsc --noEmit` passes (no TS sources yet).
- `inspect/` holds throwaway read-only DOM inspection scripts; delete before submission.

## Verified selectors (login page, read-only inspection, no login performed)
- `/pl` redirects to `/pl/login`; h2 "Zaloguj się".
- Username: `#username` (placeholder "E-mail, PESEL lub identyfikator"; no label association verified). Password: `#password` (placeholder "Hasło"). Submit: `button[type=submit]` named "Zaloguj się" (also a separate "Zaloguj się bez hasła" button, so use exact role match / form scope).
- Cookie banner button "Akceptuję" exists on load. Whether it blocks interaction is UNVERIFIED.
## Still unverified (needs login)
Post-login markers, "Umów się" menu, Recepta/Ból ucha/Duomox cards, consents and validation message DOM, PayU host (cannot be verified without a paid booking: stop-and-ask item).

## Authenticated inspection (2026-10-16, one login, read-only; no consent clicked, no booking)
VERIFIED (script `inspect/flow-dom.mjs`, credentials read from `.env`, never printed):
- Login succeeded with a single attempt; landed on `/pl`. Cookie banner "Akceptuję" is visible but did NOT block the username field (trial click ok), so it was not clicked.
- Sidebar: `a[href="/pl"]` "Konsultacje", `a[href="/pl/documentation"]` "Dokumentacja"; "Umów się" is a `button` (not a link).
- Booking flow runs on ONE URL: `/pl/make-prescription-consultation` after "Recepta" and also on the symptom, drug and summary steps. So URL assertions cannot distinguish steps; assert on visible headings/text ("Ból ucha", "Twoja konsultacja z e-receptą").
- Consent controls (input[type=checkbox], all initially unchecked, enabled): `#checkAll` ("Zaznacz wszystkie"), `#additionalAgreement1`, `#additionalAgreement2`, `#additionalAgreement3`. Labels use class `fk-checkbox__label`; mapping of agreement1-3 to the texts (c1 phone/chat, c2 no guarantee, c3 obliged to join) follows page order, not yet checked via `for=`.
- Summary buttons: "Anuluj" (`fk-button--outline`), paid button (class `fk-button`) and "Umów za 0 PLN*" (`fk-button--secondary`). The paid button's innerText read "Umów za PLN" in the script, i.e. the amount was not in innerText (probably a separate/pseudo element); do NOT locate it by "59.00" until the accessible name is checked. Candidate locator: `getByRole('button', {name: /Umów za/})` excluding "0 PLN" (class `fk-button` without `--secondary`).
- No validation/alert node exists before any click (selectors tried: role=alert, class contains error/invalid/validation).
NOT VERIFIED:
- Dashboard consultation cards: heading and status-badge queries returned nothing (probably captured before the list rendered). Whether a run-created consultation can be distinguished is therefore UNKNOWN; no booking ID/attribute observed. Current stance unchanged: manual cleanup unless ownership is provable.
- Validation message DOM (needs a click on the paid button with 000; blocked per instruction not to submit during inspection).
- Drug-card and symptom-card locators (steps worked via `getByText`, which may match more than one node; role-based locator not yet confirmed).
- PayU host: not verified (would require a booking).
- Planned return to `https://testyautomatyczne.telemedi.com/pl` after PayU: only to look at the account; no assumption that it cancels or changes anything.
Cleanup of inspection files before delivery: `Remove-Item -Recurse inspect` (project root).

## Implementation (2026-10-16)
- `k_kielb_test.spec.ts`: Main flow (NOT run), Consent validation 000/011/101/110 (parametrised, serial, one shared login), "Zaznacz wszystkie" test. README written. Helpers in same file; credentials from `.env` only.
- Locator decisions: agreement checkboxes toggled via `label[for=<id>]` (native inputs have no clickable area; force-click failed "outside of viewport"). Paid button = `button.fk-button` excluding `--secondary` (0 PLN) and `--outline` (Anuluj). PayU asserted via `expect.poll` on hostname + pathname regex only.
- Verified in a failure screenshot: validation is an inline "Pole jest wymagane" under each unchecked consent; test asserts count = number of unchecked consents.
- Observation (needs manual confirmation, not a reported bug): after "Zaznacz wszystkie" then unchecking one consent, clicking "Zaznacz wszystkie" again DESELECTED all (my first test version failed on this), which suggests select-all stays "checked" in that state. The final test avoids that sequence. Manual M6 "partial -> selects all" presumably used a partial state with select-all unchecked.
- Not implemented: dashboard check after PayU / cleanup (ownership unprovable).

## BUG-01 regression (2026-10-16)
Candidate-verified: select-all -> uncheck one -> select-all again unchecks all three. Reported in `BUGS.md` (observed vs proposed expected, no specification claimed). Regression test `BUG-01 ...` in `k_kielb_test.spec.ts`, tagged `@known-bug` + `test.fail()`. Supersedes the earlier "needs manual confirmation" note.

## Audit follow-up changes (2026-10-16)
- `npm install` now also installs Chromium (`postinstall: playwright install chromium`; not verified on a clean clone). `npm test` = `playwright test --grep-invert "Main flow"` (no consultation can be created). `npm run test:booking` = `--grep "Main flow"` (CREATES an unpaid consultation; cancel manually, only one you can prove you created). `npm run test:headed` uses the safe subset too.
- Playwright `trace` set to `'off'` (traces record typed values/URLs; masking not verified). Screenshots on failure remain; generated `test-results/` and `playwright-report/` are gitignored and were deleted.
- Removed temporary `inspect/` (only DOM inspection scripts, no hardcoded secrets). Filename stays `k_kielb_test.spec.ts`.
- Still unverified: booking test never run (PayU host/path assertion, paid button locator, step locators `getByText` exact), clean-clone install, `git check-ignore .env` (no git repo yet), CI behavior.

## Status update (2026-10-16, after booking investigation)
- Main E2E test (`npm run test:booking`) failed 3 times (hostname stayed on Telemedi, error page), then passed twice after waiting for both `/api/v2/terms/` responses before clicking (one experiment run, one run of the main test). Details in BUGS.md (OBS-01) and WORKLOG.md. This supersedes the earlier "booking test never run / PayU unverified" notes, which stay above as history.
- Experiment file `k_kielb_date_experiment.spec.ts` deleted after the fix was merged into the main test.
- Remaining: Task 2 exploration of "Wizyta zdalna", Google Doc report ("Praca z agentem"), final transcript export and redacted submission copy, manual cancellation of the unpaid consultations created by the test runs, first commit.

## BUG-02 regression test (2026-10-16)
Implemented, NOT executed: `k_kielb_task2_regression.spec.ts` (separate Task 2 credentials `TELEMEDI_TASK2_*`, skipped when unset). Route and locators unverified (no Task 2 credentials locally; read-only inspection only of the public widget translations).
