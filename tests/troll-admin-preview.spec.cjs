const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let browser;
let page;
let externalRequests = [];

before(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  page.on('request', request => {
    if (!request.url().startsWith('file:') && !request.url().startsWith('data:')) externalRequests.push(request.url());
  });
  const file = path.resolve(__dirname, '..', 'troll-admin-preview.html');
  await page.goto(pathToFileURL(file).href);
});

after(async () => {
  if (browser) await browser.close();
});

test('renders all five preview controls and makes no network requests', async () => {
  for (const action of ['shake', 'flip', 'confetti', 'freeze', 'message']) {
    assert.equal(await page.locator(`[data-action="${action}"]`).count(), 1);
  }
  await page.getByText('keine Verbindung zum Live-Spiel').waitFor();
  assert.deepEqual(externalRequests, [], 'Preview must not make external network requests');
});

test('simulates all five effects locally', async () => {
  await page.locator('[data-action="shake"]').click();
  await page.locator('#stage.shake').waitFor();
  await page.locator('[data-action="flip"]').click();
  assert.equal(await page.locator('#stage').evaluate(el => el.classList.contains('flip')), true);
  await page.locator('[data-action="confetti"]').click();
  assert.ok(await page.locator('#stage b').count() > 0);
  await page.locator('[data-action="freeze"]').click();
  assert.equal(await page.locator('#stage').evaluate(el => el.classList.contains('frozen')), true);
  await page.locator('[data-action="message"]').click();
  assert.equal(await page.locator('#stage .toast').count(), 1);
});

test('emergency stop clears effects and locks controls until deliberate re-enable', async () => {
  await page.locator('#stop').click();
  assert.equal(await page.locator('#state').textContent(), 'Not-Aus aktiv – Steuerung gesperrt');
  assert.equal(await page.locator('[data-action="shake"]').isDisabled(), true);
  assert.equal(await page.locator('#stage').evaluate(el => ['shake','flip','frozen'].some(c => el.classList.contains(c))), false);
  assert.equal(await page.locator('#stage .toast, #stage b').count(), 0);
  await page.locator('[data-action="shake"]').evaluate(el => el.click());
  assert.equal(await page.locator('#stage').evaluate(el => el.classList.contains('shake')), false);
  await page.locator('#stop').click();
  assert.equal(await page.locator('[data-action="shake"]').isDisabled(), false);
});
