import { test, expect } from '@playwright/test';

const PAGES = [
  ['home.html', /Built on craft/],
  ['portfolio.html', /proud/],
  ['ourservices.html', /one trusted team/],
  ['clienttestimonials.html', /own words/],
  ['aboutus.html', /three decades/],
  ['contactus.html', /your project/],
];

for (const [path, heading] of PAGES) {
  test(`${path} loads with its heading and no console errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`/${path}`);
    await expect(page.locator('h1')).toContainText(heading);
    expect(errors).toEqual([]);
  });

  test(`${path} has no horizontal scroll`, async ({ page }) => {
    await page.goto(`/${path}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('mobile menu opens, closes with Escape, and links work', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'menu button only shows on small screens');
  await page.goto('/home.html');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Portfolio' }).click();
  await expect(page).toHaveURL(/portfolio\.html$/);
});

test('portfolio filters and lightbox work', async ({ page }) => {
  await page.goto('/portfolio.html');
  const items = page.locator('.gallery__item');
  const visible = page.locator('.gallery__item:not([hidden])');
  const total = await items.count();

  await page.getByRole('button', { name: /Kitchens & baths/ }).click();
  const interiors = await visible.count();
  expect(interiors).toBeGreaterThan(0);
  expect(interiors).toBeLessThan(total);

  await page.getByRole('button', { name: /^All/ }).click();
  await expect(visible).toHaveCount(total);

  await visible.first().getByRole('button').click();
  const dialog = page.locator('dialog.lightbox');
  await expect(dialog).toBeVisible();
  const first = await dialog.locator('.lightbox__caption').textContent();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.locator('.lightbox__caption')).not.toHaveText(first);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('contact form requires name, email and message', async ({ page }) => {
  await page.goto('/contactus.html');
  const form = page.locator('form[name="contact"]');
  await expect(form).toHaveAttribute('data-netlify', 'true');
  await expect(form.locator('input[name="form-name"]')).toHaveValue('contact');
  expect(await form.evaluate((f) => f.checkValidity())).toBe(false);

  await page.getByLabel('Full name').fill('Test Person');
  await page.getByLabel('Email').fill('not-an-email');
  await page.locator('#message').fill('Looking to redo a bathroom.');
  expect(await form.evaluate((f) => f.checkValidity())).toBe(false);

  await page.getByLabel('Email').fill('test@example.com');
  expect(await form.evaluate((f) => f.checkValidity())).toBe(true);
});

test('chatbot never asks for an API key and renders replies safely', async ({ page }) => {
  // Stub the server function so no real API call is made.
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      json: { reply: 'Try our [contact page](contactus.html) or <img src=x onerror=alert(1)> [bad](https://evil.example)' },
    }),
  );
  await page.goto('/home.html');
  await page.getByRole('button', { name: 'Open chat' }).click();
  await expect(page.locator('#pc-chatbot input[type="password"]')).toHaveCount(0);

  await page.getByLabel('Message', { exact: true }).fill('How do I get a quote?');
  await page.getByRole('button', { name: 'Send' }).click();

  const reply = page.locator('.pc-bot').last();
  await expect(reply).toContainText('contact page');
  await expect(reply.locator('a')).toHaveCount(1);
  await expect(reply.locator('a')).toHaveAttribute('href', 'contactus.html');
  await expect(reply.locator('img')).toHaveCount(0);
});

test('chatbot shows a friendly message when the service is unavailable', async ({ page }) => {
  await page.route('**/api/chat', (route) => route.fulfill({ status: 503, json: { error: 'The assistant is busy right now.' } }));
  await page.goto('/home.html');
  await page.getByRole('button', { name: 'Open chat' }).click();
  await page.getByLabel('Message', { exact: true }).fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.pc-error')).toContainText('busy');
});
