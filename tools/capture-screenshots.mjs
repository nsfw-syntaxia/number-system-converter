/* ============================================================
   capture-screenshots.mjs — regenerates the calculator
   screenshots in img/ that the Documentation tab (and the PDF
   export) shows in "Program implementation".

   Dev-only helper; the app itself needs no build or install.

     npm install --no-save puppeteer-core
     node tools/capture-screenshots.mjs

   Uses your installed Chrome / Edge. Set CHROME_PATH if it is
   not in a standard location.
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "img");

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);

const executablePath = CANDIDATES.find(p => fs.existsSync(p));
if (!executablePath) {
  console.error("No Chrome/Edge found — set CHROME_PATH.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000, deviceScaleFactor: 1.5 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await page.goto(pathToFileURL(path.join(root, "index.html")).href, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

/** Load a test case into the calculator and let the unlock animation settle. */
async function load(pick) {
  await page.evaluate((src) => {
    const tc = new Function("TEST_CASES", "COMPLEMENT_CASES", "BCD_CASES", "return (" + src + ")")(TEST_CASES, COMPLEMENT_CASES, BCD_CASES);
    loadCase(tc);
  }, pick);
  await new Promise(r => setTimeout(r, 700));
}

/** Screenshot the union of the boxes of the elements found by these evaluated expressions. */
async function shoot(file, exprs) {
  const box = await page.evaluate((list) => {
    const els = list.map(src => new Function("return (" + src + ")")());
    const rects = els.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY };
    });
    return {
      x: Math.min(...rects.map(r => r.x)), y: Math.min(...rects.map(r => r.y)),
      r: Math.max(...rects.map(r => r.r)), b: Math.max(...rects.map(r => r.b))
    };
  }, exprs);

  const pad = 10;
  await page.screenshot({
    path: path.join(outDir, file),
    captureBeyondViewport: true,
    clip: { x: box.x - pad, y: box.y - pad, width: box.r - box.x + 2 * pad, height: box.b - box.y + 2 * pad }
  });
  console.log("wrote img/" + file);
}

const step1   = "document.querySelector('#view-calc > .block:nth-of-type(1)')";
const step2   = "document.getElementById('step-op')";
const step3   = "document.getElementById('step-result')";
const inputs  = "document.getElementById('compInputs')";
const inputsH = "document.getElementById('compInputs').previousElementSibling";
const sub = (n) => `document.getElementById('compSub${n}')`;
const subH = (n) => `document.getElementById('compSub${n}').previousElementSibling.previousElementSibling`;

// Simple chain: 1010(2) + 17(8) + 25(10)
await load("TEST_CASES.find(c => c.sample)");
await shoot("chain-inputs.png", [step1]);
await shoot("chain-result.png", [step2, step3]);

// Expression: (a + b - c) * d
await load("TEST_CASES.find(c => c.sampleExpr)");
await shoot("expr-inputs.png", [step1]);
await shoot("expr-result.png", [step2, step3]);

// Step 4 with carries at every step: 11110(2) - 9(10) - A(16)
await load("COMPLEMENT_CASES[0]");
await shoot("comp-inputs.png", [inputsH, inputs]);
await shoot("comp-ones-carry.png", [subH(1), sub(1)]);
await shoot("comp-twos-carry.png", [subH(2), sub(2)]);

// Step 4 with a negative result: 5(10) - 1010(2) - 0(16)
await load("COMPLEMENT_CASES.find(c => c.sampleComplement)");
await shoot("comp-ones-negative.png", [subH(1), sub(1)]);
await shoot("comp-twos-negative.png", [subH(2), sub(2)]);

// Step 5: BCD 12 - 30 - 1 (digit count auto)
await load("BCD_CASES.find(c => c.sampleBcd)");
const bcdHead = (id) => `document.getElementById('${id}').previousElementSibling.previousElementSibling`;
await shoot("bcd-inputs.png", ["document.getElementById('bcdInputs').previousElementSibling", "document.getElementById('bcdInputs')"]);
await shoot("bcd-add.png", [bcdHead('bcdAdd'), "document.getElementById('bcdAdd')"]);
await shoot("bcd-sub9.png", [bcdHead('bcdSub9'), "document.getElementById('bcdSub9')"]);
await shoot("bcd-sub10.png", [bcdHead('bcdSub10'), "document.getElementById('bcdSub10')"]);

await browser.close();
