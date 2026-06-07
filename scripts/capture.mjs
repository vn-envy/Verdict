// Drives the running app headlessly and screenshots the key moment of every act
// for all three cases. Deterministic: scrubs each tape to the event index that
// best represents each act. Run with the dev/preview server already up on $PORT.
//
//   PORT=3212 node scripts/capture.mjs
//
// Output: ./screenshots/<case>_<act>.png

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const PORT = process.env.PORT || "3212";
const BASE = `http://localhost:${PORT}`;
const OUT = join(ROOT, "screenshots");
mkdirSync(OUT, { recursive: true });

const CASES = [
  { id: "C", label: "Tariffs (hero)" },
  { id: "A", label: "World Cup pricing" },
  { id: "B", label: "AI wealth tax" },
];

// For each case, find the event index that represents each act, then capture cursor=index+1.
function targets(caseId) {
  const tape = JSON.parse(readFileSync(join(ROOT, "public", `case_${caseId}_tape.json`), "utf8"));
  const ev = tape.events;
  const firstIdx = (pred) => ev.findIndex(pred);
  const idxBalance = firstIdx((e) => e.event === "panel.balance");
  const idxThinking = firstIdx((e) => e.event === "juror.thinking");
  const idxReveal = firstIdx((e) => e.event === "round.blind.reveal");
  const idxFactSupported = firstIdx((e) => e.event === "factcheck.result" && e.data.status === "supported");
  const idxDA = firstIdx((e) => e.event === "devils_advocate.attack");
  const idxTurning = firstIdx((e) => e.event === "turning_point");
  const idxVerdict = firstIdx((e) => e.event === "verdict.final");
  // a couple of thinking events in for a populated "deliberating" frame
  const idxThinking4 = Math.min(idxThinking + 5, idxReveal - 1);
  const acts = [
    ["1_coldopen", idxBalance],            // Cold Open — panel cast & certified
    ["2_sealed_thinking", idxThinking4],   // Sealed Ballot — booths deliberating
    ["3_sealed_reveal", idxReveal],        // Sealed Ballot — opened
    ["4_floor_factcheck", idxFactSupported],
    ["5_floor_devils", idxDA >= 0 ? idxDA : idxFactSupported],
    ["6_turning_point", idxTurning >= 0 ? idxTurning : idxFactSupported],
    ["7_verdict", idxVerdict],
  ];
  return acts.map(([name, i]) => ({ name, cursor: i + 1 })).filter((a) => a.cursor > 0);
}

async function setCursor(page, n) {
  await page.evaluate((val) => {
    const el = document.querySelector("input.scrub");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(val));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);
  await page.waitForTimeout(900); // let CSS transitions settle
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });

for (const c of CASES) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  if (c.id !== "C") {
    await page.selectOption("select.case-select", `/case_${c.id}_tape.json`);
  }
  // wait until the tape is loaded (scrub max > 0)
  await page.waitForFunction(() => {
    const el = document.querySelector("input.scrub");
    return el && Number(el.max) > 0;
  }, { timeout: 15000 });
  // pause autoplay
  await page.getByText("Pause", { exact: false }).click().catch(() => {});

  for (const t of targets(c.id)) {
    await setCursor(page, t.cursor);
    const file = join(OUT, `case_${c.id}_${t.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`captured ${file} @ cursor ${t.cursor}`);
  }
}

await browser.close();
console.log("done");
