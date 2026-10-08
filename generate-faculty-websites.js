#!/usr/bin/env node

/**
 * Download the faculty pages listed in faculty.json and save their
 * EmployeePage-contentWrapper markup as local, styled HTML files.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const PROJECT_DIR = __dirname;
const DATA_FILE = path.join(PROJECT_DIR, "faculty.json");
const OUTPUT_DIR = path.join(PROJECT_DIR, "Fac_Website");
const CSS_OUTPUT_FILE = path.join(OUTPUT_DIR, "faculty-profile.css");
const MANIFEST_FILE = path.join(OUTPUT_DIR, "profile-manifest.js");
const DEFAULT_CSS_SOURCE = path.resolve(PROJECT_DIR, "../../testingFacPageOpen.css");
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const CONCURRENCY = 5;
const TOUCH_PROFILE_CSS = `

/* InfoDisplay touch-first profile overrides */
html {
  min-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  touch-action: pan-y;
}

html::-webkit-scrollbar {
  display: none;
}

body {
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  cursor: default;
}

body, body * {
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
`;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function profileFilename(name) {
  const filename = String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${filename || "faculty"}.html`;
}

function findContentWrapper(html) {
  const openingTagPattern = /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bEmployeePage-contentWrapper\b[^"']*\1[^>]*>/i;
  const openingMatch = openingTagPattern.exec(html);
  if (!openingMatch) return null;

  const openingEnd = openingMatch.index + openingMatch[0].length;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = openingEnd;

  let depth = 1;
  let match;
  while ((match = tagPattern.exec(html))) {
    if (/^<\/div\b/i.test(match[0])) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(openingMatch.index, tagPattern.lastIndex);
      }
    } else if (!/\/\s*>$/.test(match[0])) {
      depth += 1;
    }
  }

  return null;
}

function makeLinksTextOnly(markup) {
  return markup.replace(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi, (_match, contents) => {
    return contents.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, "");
  });
}

function createDocument(name, wrapperMarkup) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer-when-downgrade">
    <title>${escapeHtml(name)} - Faculty Profile</title>
    <link rel="stylesheet" href="faculty-profile.css">
  </head>
  <body>
${makeLinksTextOnly(wrapperMarkup)}
  </body>
</html>
`;
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "InfoDisplay faculty profile exporter",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function copyStylesheet() {
  const configuredSource = process.env.FACULTY_PROFILE_CSS || DEFAULT_CSS_SOURCE;
  let stylesheet;
  try {
    stylesheet = await fs.readFile(configuredSource, "utf8");
    console.log(`Copied stylesheet: ${path.basename(configuredSource)}`);
  } catch (error) {
    try {
      stylesheet = await fs.readFile(CSS_OUTPUT_FILE, "utf8");
      console.warn(`Stylesheet source unavailable; keeping existing ${path.basename(CSS_OUTPUT_FILE)}.`);
    } catch {
      throw new Error(`Could not copy stylesheet from ${configuredSource}: ${error.message}`);
    }
  }
  if (!stylesheet.includes("InfoDisplay touch-first profile overrides")) {
    stylesheet = `${stylesheet.trimEnd()}${TOUCH_PROFILE_CSS}\n`;
  }
  await fs.writeFile(CSS_OUTPUT_FILE, stylesheet, "utf8");
}

async function writeProfile(name, person) {
  const url = String(person?.["Link to Website"] || "").trim();
  const filename = profileFilename(name);
  if (!url) {
    return { name, filename, status: "skipped", message: "missing Link to Website" };
  }

  try {
    const source = await fetchPage(url);
    const wrapper = findContentWrapper(source);
    if (!wrapper) {
      throw new Error("EmployeePage-contentWrapper was not found");
    }
    await fs.writeFile(path.join(OUTPUT_DIR, filename), createDocument(name, wrapper), "utf8");
    return { name, filename, status: "saved" };
  } catch (error) {
    return { name, filename, status: "failed", message: error.message };
  }
}

async function mapWithConcurrency(entries, worker, limit) {
  const results = [];
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < entries.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(entries[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, entries.length) }, runWorker));
  return results;
}

async function writeManifest(results) {
  const profiles = Object.fromEntries(
    results
      .filter((result) => result.status === "saved")
      .map((result) => [result.name, result.filename]),
  );
  const contents = `// Generated by generate-faculty-websites.js.\nwindow.FACULTY_PROFILES = ${JSON.stringify(profiles, null, 2)};\n`;
  await fs.writeFile(MANIFEST_FILE, contents, "utf8");
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await copyStylesheet();

  const faculty = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const entries = Object.entries(faculty);
  const results = await mapWithConcurrency(entries, ([name, person]) => writeProfile(name, person), CONCURRENCY);
  await writeManifest(results);

  for (const result of results) {
    const suffix = result.message ? ` (${result.message})` : "";
    console.log(`${result.status.padEnd(7)} ${result.name} -> ${result.filename}${suffix}`);
  }

  const saved = results.filter((result) => result.status === "saved").length;
  const failed = results.filter((result) => result.status === "failed");
  const skipped = results.filter((result) => result.status === "skipped").length;
  console.log(`\nSaved ${saved}/${entries.length} profiles${skipped ? `; skipped ${skipped}` : ""}.`);
  if (failed.length) {
    console.error(`${failed.length} profile(s) failed. Re-run the script to retry them.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
