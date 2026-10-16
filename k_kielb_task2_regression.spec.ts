import { test, expect, type Page } from '@playwright/test';

// Task 2 regression test (BUG-02). Uses its OWN patient account (never the Task 1 credentials):
// TELEMEDI_TASK2_USERNAME / TELEMEDI_TASK2_PASSWORD in .env (see .env.example). Creates no consultation.
const username = process.env.TELEMEDI_TASK2_USERNAME;
const password = process.env.TELEMEDI_TASK2_PASSWORD;
// Missing, blank, or the .env.example placeholders (your-...-here) all count as "not configured" for BOTH values.
const isPlaceholder = (value?: string) => !value || !value.trim() || /^your-.*-here$/i.test(value.trim());
const configured = !isPlaceholder(username) && !isPlaceholder(password);

// Single login attempt per test; never used for invalid-login checks.
async function login(page: Page) {
  await page.goto('/pl');
  await page.locator('#username').fill(username!);
  await page.locator('#password').fill(password!);
  await page.locator('form').getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Umów się' })).toBeVisible();
  await expect(page.locator('#username')).toHaveCount(0);
}

test.describe('Task 2 regression (Wizyta zdalna, creates nothing)', () => {
  test.skip(!configured, 'Set TELEMEDI_TASK2_USERNAME and TELEMEDI_TASK2_PASSWORD in .env (separate Task 2 patient account).');

  // BUG-02 (see BUGS.md): a patient who is already logged in sees "Wymagane zalogowanie na konto pacjenta"
  // after choosing the "Czat" channel in "Wizyta zdalna". Expected: the message is not shown to an authenticated user.
  // test.fail() is called only AFTER login, navigation and the click on "Czat" succeeded, so setup errors fail normally.
  // While the bug exists the final assertion fails (reported as an expected failure); once it is fixed the test
  // "passes unexpectedly" (reported as a failure) and test.fail() must be removed.
  test('BUG-02: logged-in patient does not see the login-required message after selecting "Czat"', { tag: '@known-bug' }, async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Umów się' }).click();
    await page.getByText('Wizyta zdalna', { exact: true }).click();
    // Channel label may be "Czat" or "Przez czat" (both strings exist in the widget translations; not verified here).
    await page.getByText(/^(Przez )?czat$/i).first().click();

    test.fail(true, 'BUG-02: login-required message is shown to an already authenticated patient');
    await expect(page.getByText('Wymagane zalogowanie na konto pacjenta')).not.toBeVisible({ timeout: 3000 });
  });
});
