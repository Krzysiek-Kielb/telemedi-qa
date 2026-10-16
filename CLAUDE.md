# Telemedi QA Recruitment Assignment — Project Rules

Target app: https://testyautomatyczne.telemedi.com/pl (shared test environment).
Candidate is learning and stays in control. Candidate-facing explanations in Polish; code, identifiers and technical docs in English.

## Honesty rules
- Never claim a command/test passed unless it was executed and the result observed.
- Never fabricate bugs, app behavior, command output or session history.
- Label clearly: candidate-observed fact / verified execution result / hypothesis / proposal.
- `WORKLOG.md` is a progress journal ONLY. It is not the session transcript and must never be presented as one. Never reconstruct or beautify a transcript.

## Workflow gates (ask candidate first)
- Do not implement tests until the candidate has personally explored the booking flow.
- Do not explore the app on the candidate's behalf; do not invent bugs.
- Need explicit approval for: installing dependencies, `git init`, creating GitHub repos, publishing code, creating/sharing the Google Doc, submitting.
- Smallest viable implementation; no unnecessary dependencies/abstractions. ~3h total budget.

## Task 1 (Playwright + TypeScript)
- File: `initial_surname_test.spec.ts` (no Polish characters).
- Flow: login -> book consultation with prescription -> stop at handoff to external payment operator. NEVER pay.
- Plus at least one more meaningful test (one-sentence purpose).
- Meaningful assertions, CI-stable (no brittle waits/shared-state assumptions), must demonstrably fail when behavior breaks.
- Credentials/config in ONE place (`.env`, gitignored; commit `.env.example` only).
- README <= half a page: clone, install, test commands, known-bug labelling approach.

## Task 2 (exploratory + regression)
- Candidate creates own patient account with synthetic data; explores "Wizyta zdalna".
- Report bugs only if candidate personally observed them. Developer-ready: steps, actual vs expected, priority, one sentence on automation level (E2E/API/unit).
- Regression test for one confirmed bug, marked `test.fail()` or `@known-bug`; else document design + assertions.

## Task 3
- Report section "Praca z agentem": tool/model, collaboration, concrete references to the genuine session log.

## Safety
- Synthetic data only. No real patient data. Never complete payment.
- Shared candidate account: only for intended flow. NEVER for invalid-login tests (5 failures = 5 min global lock). Use nonexistent user or own account.
- No defects reported for third-party services (payment operator).
- Cancel all consultations reserved before finishing.
- Never commit passwords, tokens, cookies, `.env`.

## Session log
- Genuine transcript is exported by the candidate/app (see WORKLOG.md / PLAN.md); accepted formats `.txt .md .json .jsonl`, within size limit. Redact only sensitive parts, never falsify the rest.
- Update `WORKLOG.md` after each meaningful phase with actions that actually happened.
