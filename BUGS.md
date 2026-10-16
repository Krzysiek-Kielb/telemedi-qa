# Task 2 – bug reports (draft, facts observed by the candidate)

## BUG-01 – "Zaznacz wszystkie" unchecks all consents when clicked after one consent was unchecked
- **Area:** Prescription consultation summary (`/pl/make-prescription-consultation`), consents.
- **Priority (proposal):** Low–Medium. Only a UI convenience control misbehaves; individual consents still work and submission validation is correct (verified manually: incomplete consents show "Pole jest wymagane" and do not reach PayU). Impact: confusing UX, user may re-enter consents, risk of mistaken understanding of which consents are given.
- **Steps:** 1) Log in. 2) Umów się → Recepta → Ból ucha → Duomox. 3) On the summary click "Zaznacz wszystkie". 4) Manually uncheck one of the three consents. 5) Click "Zaznacz wszystkie" again.
- **Actual (observed):** step 3: all three checked; step 4: the other two stay checked; step 5: all three become unchecked. (Automated run also showed the same, in this sequence.)
- **Expected (proposal, not from a specification):** after step 4 not all consents are given, so step 5 should select the missing consent (all three checked). Alternatively the control should visibly leave the "checked" state in step 4 so that the next click clearly means "select all". The product specification was not available; the current behavior is also consistent with a simple toggle.
- **Not covered / unknown:** the visual state of the "Zaznacz wszystkie" checkbox after step 4 was not recorded.
- **Automation:** yes, E2E (UI state across clicks on one page); the logic itself could also be a unit/component test of the checkbox-group state. API level not applicable. Regression test: `k_kielb_test.spec.ts`, `BUG-01 ...` (`@known-bug`, `test.fail()`).

## OBS-01 – Observation (NOT confirmed as a defect): booking click before the widget has stored a date
- **Evidence (automated runs, 16.10.2026):** three runs clicked the paid button ~0.5 s after choosing Duomox. In the run that logged the request, `POST /api/v2/consultations` had `date: "Invalid date"` and returned HTTP 400; the UI showed "Wystąpił nieoczekiwany błąd" with a "Spróbuj ponownie" button. After the test waited for both `GET /api/v2/terms/…` responses (`showFreePozTerms=0` and `=1`) before clicking, two runs sent a valid date (`2026-10-16T14:00:00`), got HTTP 201 and reached PayU.
- **Widget source (public `widget.telemedi.com/consbook-widget/widget.js`, minified; read-only inspection):** choosing a drug starts two term lookups; the first returned term's `start` becomes the booking date; the paid-button handler reads that stored date and sends `"Invalid date"` when none is set.
- **`NoAvailableDatesError` / `TypeError … 'start'`:** raised by the widget when a lookup returns no items (`c[0].start` is unguarded). Logged with the `showFreePozTerms=1` lookup, which returned 0 items in the successful run (`showFreePozTerms=0` returned 1). It also appeared in successful runs, so it did not block booking there.
- **Status:** candidate-observed only through automation; a manual run succeeded (slower clicks). Not reproduced manually, so not reported as a bug.
- **Suggested fix (proposal, widget owner):** disable the paid button or await the lookups until a date is stored; guard empty results (`items[0]?.start`) and show a message; do not send `"Invalid date"` (and answer 4xx with a clear validation error).
- **Automation:** E2E (timing of UI vs. network); the empty-list guard is a unit test of the widget function; the API accepting `"Invalid date"` is an API-level test (400 with a clear message).

## BUG-02 – "Wymagane zalogowanie na konto pacjenta" shown to an already logged-in patient after selecting "Czat" (Wizyta zdalna)
- **Source:** candidate's manual exploratory testing with a separate synthetic patient account (details of the observation come from the candidate; not re-observed by automation).
- **Steps:** 1) Log in with a patient account. 2) Umów się → Wizyta zdalna. 3) Select the "Czat" channel.
- **Actual:** the message "Wymagane zalogowanie na konto pacjenta" is displayed although the patient is authenticated.
- **Expected (proposal):** no login-required message for an authenticated patient.
- **Hint from the public widget source (read-only, not proof):** its Polish translations contain a static channel description "Wymagane zalogowanie na konto pacjenta." for the video and chat channels (`consultationChannelNameExtended`), next to "Lekarz zadzwoni na twój telefon." for the phone channel. Whether the page shows it unconditionally was not verified.
- **Priority: High (provisional)** – to be confirmed after the issue is reproduced and its actual impact is verified; the observation comes from the candidate's manual exploration and was not reproduced by automation.
- **Automation:** E2E (UI state after a channel choice); a component/unit test of the channel description rendering is also possible.
- **Regression test:** `k_kielb_task2_regression.spec.ts` (`@known-bug` + `test.fail()`), not yet executed; the "Czat" locator (`/^(Przez )?czat$/i`) and the route via "Umów się" → "Wizyta zdalna" are unverified because Task 2 credentials were not available locally.
