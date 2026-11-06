// Regenerates the README screenshots: `npm run serve` in one terminal, then `node scripts/screenshots.mjs`.
import { chromium, devices } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const shots = [
  { name: 'home-desktop', path: '/home.html', viewport: { width: 1440, height: 900 } },
  { name: 'services-desktop', path: '/ourservices.html', viewport: { width: 1440, height: 900 }, scrollTo: '.service-row' },
  { name: 'portfolio-desktop', path: '/portfolio.html', viewport: { width: 1440, height: 900 }, scrollTo: '.filters' },
  { name: 'home-mobile', path: '/home.html', device: 'iPhone 13' },
  { name: 'contact-mobile', path: '/contactus.html', device: 'iPhone 13', scrollTo: 'form' },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext(s.device ? devices[s.device] : { viewport: s.viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}.hero__media img{transform:none!important}' });
  if (s.scrollTo) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);
    }, s.scrollTo);
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `docs/screenshots/${s.name}.jpg`, type: 'jpeg', quality: 80 });
  await ctx.close();
  console.log('saved', s.name);
}
await browser.close();
