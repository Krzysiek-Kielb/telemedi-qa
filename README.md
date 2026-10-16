# Telemedi QA – Playwright + TypeScript

Tests for https://testyautomatyczne.telemedi.com/pl (shared environment).

```bash
git clone https://github.com/Krzysiek-Kielb/telemedi-qa.git && cd telemedi-qa
cp .env.example .env     # fill in TELEMEDI_USERNAME/PASSWORD (Task 1) and TELEMEDI_TASK2_USERNAME/PASSWORD (Task 2); never commit .env
npm install              # dependencies + Chromium (postinstall)
npm test                 # safe tests: create no consultation
npm run test:booking     # booking test: CREATES a consultation (see warning)
```

- **Main flow** (`k_kielb_test.spec.ts`, `test:booking`) – login → Recepta → Ból ucha → Duomox → 3 consents → paid button; waits for both `/api/v2/terms/` lookups first (the widget picks the date itself); asserts redirect to `secure.payu.com/pay/` (host + path) and stops. No payment.
- **Consent validation** (`000`, `011`, `101`, `110`) – additional test: any missing consent blocks booking ("Pole jest wymagane", no PayU).
- **"Zaznacz wszystkie"** – select/deselect-all behaviour.
- **Known bugs** (`@known-bug`, see `BUGS.md`) use `test.fail()`: reported as passed while the bug exists; once fixed they go red, then remove `test.fail()`.
  - BUG-01 – after one consent is unchecked, select-all unchecks all.
  - BUG-02 (`k_kielb_task2_regression.spec.ts`) – a logged-in patient must not see "Wymagane zalogowanie na konto pacjenta" after choosing "Czat" in "Wizyta zdalna". Uses only the separate Task 2 account (skipped if unset); creates nothing; not yet executed.

**Warning (`test:booking`):** it runs the real flow, stops at the redirect to PayU and never enters payment data (do not extend it to pay), but it creates an unpaid consultation; no safe automatic cleanup exists, so cancel it manually ("Anuluj") and never cancel others'. Never use the shared account for invalid-login checks (5 failures lock it for 5 min).
