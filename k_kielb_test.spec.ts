import { test, expect, type Page } from '@playwright/test';

// Credentials come from .env (see .env.example); never hardcode or log them.
function credentials() {
  const username = process.env.TELEMEDI_USERNAME;
  const password = process.env.TELEMEDI_PASSWORD;
  if (!username || !password || username.startsWith('your-')) {
    throw new Error('Set TELEMEDI_USERNAME and TELEMEDI_PASSWORD in .env (see .env.example).');
  }
  return { username, password };
}

const AGREEMENT_IDS = ['additionalAgreement1', 'additionalAgreement2', 'additionalAgreement3'] as const;

// Single login attempt per call; never used for invalid-login checks (shared account lock risk).
async function login(page: Page, step: Step = noStep) {
  const { username, password } = credentials();
  step('login: open /pl');
  await page.goto('/pl');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  step('login: submit');
  await page.locator('form').getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Umów się' })).toBeVisible();
  await expect(page.locator('#username')).toHaveCount(0);
  step('login: done');
}

// Walks login-independent booking steps up to the summary. Creates nothing.
async function openPrescriptionSummary(page: Page, step: Step = noStep) {
  step('flow: open /pl');
  await page.goto('/pl');
  step('flow: click "Umów się"');
  await page.getByRole('button', { name: 'Umów się' }).click();
  step('flow: click "Recepta"');
  await page.getByText('Recepta', { exact: true }).click();
  step('flow: click "Ból ucha"');
  await page.getByText('Ból ucha', { exact: true }).click();
  step('flow: click "Duomox"');
  await page.getByText('Duomox', { exact: true }).click();
  await expect(page.getByText('Twoja konsultacja z e-receptą')).toBeVisible();
  step('flow: summary visible');
  await expect(page.locator('#checkAll')).not.toBeChecked();
  for (const id of AGREEMENT_IDS) await expect(page.locator(`#${id}`)).not.toBeChecked();
}

// The paid button text is "Umów za <amount>"; the "0 PLN" variant carries fk-button--secondary and Anuluj fk-button--outline.
const paidButton = (page: Page) =>
  page.locator('button.fk-button:not(.fk-button--secondary):not(.fk-button--outline)', { hasText: /Umów za/ });

// ---- Diagnostics (main flow only): step markers, console/page errors, network around booking ----
type Step = (name: string) => void;
const noStep: Step = () => {};
const t0 = Date.now();
const stamp = () => `+${((Date.now() - t0) / 1000).toFixed(2)}s`;
const diag = (msg: string) => console.log(`[diag ${stamp()}] ${msg}`);

// Never log query strings, fragments or long digit runs (ids); PayU URLs are reduced to host + first path segment.
function safeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.hostname.includes('payu') ? u.pathname.split('/').slice(0, 2).join('/') + '/…' : u.pathname;
    return `${u.hostname}${path.replace(/\d{6,}/g, '<n>')}`;
  } catch {
    return '<unparsable-url>';
  }
}

function attachDiagnostics(page: Page) {
  const started = new Map<unknown, number>();
  const took = (r: unknown) => (started.has(r) ? `${Date.now() - started.get(r)!}ms` : 'n/a');
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) diag(`url -> ${safeUrl(f.url())}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      diag(`console.${m.type()}: ${m.text().replace(/\d{6,}/g, '<n>').slice(0, 200)}`);
    }
  });
  page.on('pageerror', (e) => diag(`pageerror: ${e.name}: ${e.message.slice(0, 200)}`));
  page.on('request', (r) => started.set(r, Date.now()));
  page.on('requestfailed', (r) =>
    diag(`requestfailed ${r.method()} ${safeUrl(r.url())}: ${r.failure()?.errorText ?? 'unknown'} (${took(r)})`),
  );
  page.on('response', (res) => {
    const r = res.request();
    const type = r.resourceType();
    // Only API calls, documents and anything that failed; static assets are skipped. No headers, no bodies.
    if (res.status() >= 400 || type === 'xhr' || type === 'fetch' || type === 'document') {
      diag(`response ${res.status()} ${r.method()} ${type} ${safeUrl(res.url())} (${took(r)})`);
    }
  });

  // Targeted booking-race diagnostics: terms lookups (status, showFreePozTerms, item count only) and the
  // `date` field of the consultation request. Nothing else from bodies is logged; parsing errors are swallowed.
  page.on('response', async (res) => {
    try {
      const url = new URL(res.url());
      if (!url.pathname.startsWith('/api/v2/terms/')) return;
      let items = 'n/a';
      try {
        const body = await res.json();
        const list = Array.isArray(body?.items) ? body.items : body?.data?.items; // top-level first, nested as fallback
        if (Array.isArray(list)) items = String(list.length);
      } catch {
        /* non-JSON or unreadable body */
      }
      diag(`terms: status=${res.status()} showFreePozTerms=${url.searchParams.get('showFreePozTerms') ?? 'n/a'} items=${items}`);
    } catch {
      /* diagnostics must never break the test */
    }
  });
  page.on('request', (r) => {
    try {
      if (r.method() !== 'POST' || new URL(r.url()).pathname !== '/api/v2/consultations') return;
      const date = (r.postDataJSON() as { date?: unknown } | null)?.date;
      diag(`consultations POST body date=${typeof date === 'string' ? date.slice(0, 40) : `<${typeof date}>`}`);
    } catch {
      diag('consultations POST body date=<unreadable>');
    }
  });
}

// Logs the current host/path every 2 s while waiting for the handoff; returns a stop function.
function watchUrl(page: Page) {
  const timer = setInterval(() => diag(`waiting for handoff, now at ${safeUrl(page.url())}`), 2000);
  return () => clearInterval(timer);
}

async function logPageState(page: Page) {
  try {
    const heading = await page.locator('h1, h2').first().textContent({ timeout: 2000 });
    diag(`page heading: ${heading?.trim().slice(0, 120)}`);
    diag(`retry button visible: ${await page.getByRole('button', { name: 'Spróbuj ponownie' }).isVisible()}`);
  } catch (e) {
    diag(`could not read page state: ${(e as Error).message.slice(0, 100)}`);
  }
}

// Native checkbox inputs have no clickable area, so each one is toggled through its label.
const toggle = (page: Page, id: string) => page.locator(`label[for="${id}"]`).click();

test.describe('Main flow (creates a consultation - see README cleanup note)', () => {
  test('books a prescription consultation and stops at the PayU handoff', async ({ page }) => {
    attachDiagnostics(page); // attached before the booking action; only logs, never changes behavior
    await login(page, diag);

    // The widget picks the booking date itself: choosing a drug starts two terms lookups (showFreePozTerms=0 and =1)
    // and stores the first returned term. Clicking the paid button before they finish sends date "Invalid date"
    // and the API answers 400 (observed in earlier runs). So wait for BOTH responses, independent of order.
    // The waits are registered before the Duomox click (inside openPrescriptionSummary) so none can be missed.
    const termsResponse = (flag: '0' | '1') => {
      const wait = page.waitForResponse((res) => {
        const u = new URL(res.url());
        return res.request().method() === 'GET' && u.pathname.startsWith('/api/v2/terms/') && u.searchParams.get('showFreePozTerms') === flag;
      });
      wait.catch(() => {}); // avoid an unhandled rejection if the test fails earlier; awaiting it later still throws
      return wait;
    };
    const termsPaid = termsResponse('0');
    const termsPoz = termsResponse('1');
    await openPrescriptionSummary(page, diag);

    await expect(page.getByText('Duomox').first()).toBeVisible();
    await expect(page.getByText('Zaznacz wszystkie')).toBeVisible();
    diag('summary: selecting consents');
    for (const id of AGREEMENT_IDS) await toggle(page, id);
    for (const id of AGREEMENT_IDS) await expect(page.locator(`#${id}`)).toBeChecked();
    diag('summary: 3 consents verified checked');

    await Promise.all([termsPaid, termsPoz]);
    diag('booking: both terms lookups (showFreePozTerms=0 and 1) have responded');

    await expect(paidButton(page)).toHaveCount(1);
    diag('booking: BEFORE paid-button click');
    await paidButton(page).click();
    diag('booking: AFTER paid-button click');

    // Assert only host and path, never the full URL (orderId/token are unique and secret-like).
    const stopWatch = watchUrl(page);
    try {
      await expect.poll(() => new URL(page.url()).hostname, { timeout: 30_000 }).toBe('secure.payu.com');
    } catch (e) {
      await logPageState(page); // diagnostics only; the original error is rethrown
      throw e;
    } finally {
      stopWatch();
    }
    diag('handoff: reached secure.payu.com');
    expect(new URL(page.url()).pathname).toMatch(/^\/pay\//);
    // Stop here: no interaction with the payment page.
  });
});

test.describe('Consent validation (blocks booking, creates nothing)', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ locale: 'pl-PL' })).newPage();
    await login(page);
  });
  test.afterAll(async () => page.context().close());

  // 1 = checked, order = additionalAgreement1..3
  for (const combo of ['000', '011', '101', '110']) {
    test(`incomplete consents ${combo} do not reach PayU`, async () => {
      await openPrescriptionSummary(page);
      const summaryUrl = page.url();
      for (const [i, bit] of [...combo].entries()) if (bit === '1') await toggle(page, AGREEMENT_IDS[i]);
      for (const [i, bit] of [...combo].entries()) {
        await expect(page.locator(`#${AGREEMENT_IDS[i]}`)).toBeChecked({ checked: bit === '1' });
      }

      await paidButton(page).click();

      // One inline "Pole jest wymagane" message per unchecked consent (observed in a failure screenshot).
      const missing = [...combo].filter((bit) => bit === '0').length;
      await expect(page.getByText('Pole jest wymagane')).toHaveCount(missing);
      // Still on the summary on Telemedi, never on PayU.
      await expect(page.getByText('Twoja konsultacja z e-receptą')).toBeVisible();
      expect(new URL(page.url()).hostname).not.toContain('payu');
      expect(page.url()).toBe(summaryUrl);
    });
  }
});

test.describe('"Zaznacz wszystkie" select-all control (creates nothing)', () => {
  test('selects all from empty and partial, deselects all from full, and leaves other consents when one is unchecked', async ({ page }) => {
    await login(page);
    await openPrescriptionSummary(page);
    const agreement = (n: number) => page.locator(`#${AGREEMENT_IDS[n]}`);
    const expectAll = async (checked: boolean) => {
      for (let i = 0; i < 3; i++) await expect(agreement(i)).toBeChecked({ checked });
    };

    await toggle(page, 'checkAll'); // from none
    await expectAll(true);

    await toggle(page, 'additionalAgreement2'); // manual uncheck keeps the other two
    await expect(agreement(0)).toBeChecked();
    await expect(agreement(1)).not.toBeChecked();
    await expect(agreement(2)).toBeChecked();

    await openPrescriptionSummary(page);
    await toggle(page, 'additionalAgreement1'); // partial selection, select-all untouched
    await toggle(page, 'checkAll');
    await expectAll(true);

    await toggle(page, 'checkAll'); // from all selected
    await expectAll(false);
  });
});
test.describe('Known bugs (regression)', () => {
  // BUG-01 (see BUGS.md). Proposed expected behavior: when not all consents are checked,
  // "Zaznacz wszystkie" selects the missing ones. Observed: it unchecks all three instead.
  // test.fail() is called only AFTER login, navigation and the whole checkbox sequence were verified,
  // so authentication, selector or timing errors before that point fail the test normally.
  // While the bug exists the final assertion fails (reported as an expected failure); once the bug is
  // fixed the test "passes unexpectedly" (reported as a failure) and test.fail() must be removed.
  test('BUG-01: "Zaznacz wszystkie" selects all consents after one was unchecked manually', { tag: '@known-bug' }, async ({ page }) => {
    const agreement = (n: number) => page.locator(`#${AGREEMENT_IDS[n]}`);

    await login(page);
    await openPrescriptionSummary(page);

    await toggle(page, 'checkAll');
    for (let i = 0; i < 3; i++) await expect(agreement(i)).toBeChecked();
    await toggle(page, 'additionalAgreement2');
    await expect(agreement(0)).toBeChecked();
    await expect(agreement(1)).not.toBeChecked();
    await expect(agreement(2)).toBeChecked();

    await toggle(page, 'checkAll'); // the step under test
    await expect(page.getByText('Twoja konsultacja z e-receptą')).toBeVisible(); // still on the summary

    test.fail(true, 'BUG-01: select-all deselects everything when clicked after one consent was unchecked');
    for (let i = 0; i < 3; i++) await expect(agreement(i)).toBeChecked({ timeout: 3000 });
  });
});
