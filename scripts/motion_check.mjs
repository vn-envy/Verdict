// Captures mid-animation frames to verify motion renders (not just end states).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || "3216";
const OUT = join(ROOT, "screenshots");
mkdirSync(OUT, { recursive: true });

async function jumpTo(page, n) {
  await page.evaluate((val) => {
    const el = document.querySelector("input.scrub");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(val));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => Number(document.querySelector("input.scrub")?.max) > 0);
await page.getByText("Pause", { exact: false }).click().catch(() => {});

// 1) Typewriter mid-reveal — jump to Okun's first claim (cursor 35), grab quickly.
await jumpTo(page, 35);
await page.waitForTimeout(220);
await page.screenshot({ path: join(OUT, "motion_typewriter.png") });
console.log("captured motion_typewriter.png");

// 2) Turning-point flash — reset then jump to the turning point (cursor 68), grab at peak.
await jumpTo(page, 10);
await page.waitForTimeout(150);
await jumpTo(page, 68);
await page.waitForTimeout(130);
await page.screenshot({ path: join(OUT, "motion_turningpoint.png") });
console.log("captured motion_turningpoint.png");

await browser.close();
console.log("done");
