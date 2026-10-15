/**
 * Enrich product descriptions from Cabesto product pages.
 * Replaces SEO boilerplate ("Achetez … chez Cabesto") with the real #description fiche.
 *
 * Default: HTTP fetch (undici). Falls back to Puppeteer with --puppeteer.
 *
 *   node scripts/enrich-product-descriptions.mjs
 *   node scripts/enrich-product-descriptions.mjs --limit=20
 *   node scripts/enrich-product-descriptions.mjs --dry-run --limit=5
 *   node scripts/enrich-product-descriptions.mjs --force
 *   node scripts/enrich-product-descriptions.mjs --sku=AL-0002587
 *   node scripts/enrich-product-descriptions.mjs --concurrency=1 --delay=2000
 *   node scripts/enrich-product-descriptions.mjs --wait-ok   # poll until 429 clears
 *   node scripts/enrich-product-descriptions.mjs --puppeteer
 *
 * State (resume): data/.enrich-descriptions-state.json
 * After a full run: node scripts/sync-product-descriptions.mjs && npm run rag:index
 */
import fs from "node:fs";
import path from "node:path";
import { fetch } from "undici";

const ROOT = process.cwd();
const PRODUCTS_DIR = path.join(ROOT, "data", "products");
const STATE_PATH = path.join(ROOT, "data", ".enrich-descriptions-state.json");

const SEO_RE = /^Achetez .+ chez Cabesto/i;
const DEFAULT_MIN_LEN = 180;
const DEFAULT_DELAY_MS = 2000;
const DEFAULT_CONCURRENCY = 1;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function parseArgs(argv) {
  const out = {
    limit: 0,
    dryRun: false,
    force: false,
    minLen: DEFAULT_MIN_LEN,
    delayMs: DEFAULT_DELAY_MS,
    concurrency: DEFAULT_CONCURRENCY,
    sku: null,
    headful: false,
    puppeteer: false,
    waitOk: false,
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a === "--headful") out.headful = true;
    else if (a === "--puppeteer") out.puppeteer = true;
    else if (a === "--wait-ok") out.waitOk = true;
    else if (a.startsWith("--limit=")) out.limit = Number(a.slice(8)) || 0;
    else if (a.startsWith("--min-len=")) out.minLen = Number(a.slice(10)) || DEFAULT_MIN_LEN;
    else if (a.startsWith("--delay=")) out.delayMs = Number(a.slice(8)) || DEFAULT_DELAY_MS;
    else if (a.startsWith("--concurrency="))
      out.concurrency = Math.max(1, Number(a.slice(14)) || DEFAULT_CONCURRENCY);
    else if (a.startsWith("--sku=")) out.sku = a.slice(6).trim();
  }
  return out;
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { done: {}, failed: {}, updatedAt: null };
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { done: {}, failed: {}, updatedAt: null };
  }
}

let stateWriteChain = Promise.resolve();
function saveState(state) {
  stateWriteChain = stateWriteChain.then(() => {
    const payload = {
      done: { ...state.done },
      failed: { ...state.failed },
      updatedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(payload, null, 2), "utf8");
  });
  return stateWriteChain;
}

function needsEnrich(product, { force, minLen }) {
  if (force) return true;
  if (product.descriptionEnrichedAt && product.descriptionSource === "fiche") return false;
  const d = (product.description || "").trim();
  if (!d) return true;
  if (SEO_RE.test(d)) return true;
  if (d.length < minLen) return true;
  return false;
}

function cleanDescription(raw) {
  let text = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
  text = text.replace(/^DESCRIPTION\s*/i, "").trim();
  text = text.replace(/\nEntreprise française[\s\S]*$/i, "").trim();
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function is404Text(bodyText) {
  return /Oups ! La page demandée n'existe pas/i.test(bodyText || "");
}

function isRateLimited(scraped) {
  if (scraped?.status === 429) return true;
  const blob = `${scraped?.title || ""} ${scraped?.bodyText || ""} ${scraped?.raw || ""}`;
  return /request limit exceeded|too many requests/i.test(blob);
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractDescriptionFromHtml(html) {
  const statusText = htmlToText(html).slice(0, 200);
  if (/request limit exceeded/i.test(statusText)) {
    return {
      raw: "",
      title: "Request limit exceeded",
      bodyText: statusText,
      hasEl: false,
      status: 429,
    };
  }

  const idMatch = html.match(
    /id=["']description["'][^>]*>([\s\S]*?)(?:<\/div>\s*(?:<div|<\/section)|$)/i,
  );
  let raw = "";
  if (idMatch) {
    raw = htmlToText(idMatch[1]);
  } else {
    // Magento / JSON-LD fallbacks
    const ld = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );
    if (ld) {
      for (const block of ld) {
        try {
          const json = JSON.parse(block.replace(/<\/?script[^>]*>/gi, ""));
          const nodes = Array.isArray(json) ? json : [json];
          for (const n of nodes) {
            const d = n?.description || n?.Offers?.description;
            if (typeof d === "string" && d.trim().length > 40) {
              raw = htmlToText(d);
              break;
            }
          }
        } catch {
          /* ignore */
        }
        if (raw) break;
      }
    }
  }

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 ? htmlToText(h1[1]) : "";
  return {
    raw,
    title,
    bodyText: statusText,
    hasEl: !!idMatch || !!raw,
    status: 200,
  };
}

async function scrapeHttp(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
    },
    redirect: "follow",
  });
  const html = await res.text();
  if (res.status === 429) {
    return {
      raw: "",
      title: "Request limit exceeded",
      bodyText: "Request limit exceeded",
      hasEl: false,
      status: 429,
    };
  }
  const parsed = extractDescriptionFromHtml(html);
  parsed.status = res.status;
  return parsed;
}

async function waitUntilOk(probeUrl) {
  console.log(`Waiting until Cabesto accepts requests (probe: ${probeUrl})…`);
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const scraped = await scrapeHttp(probeUrl);
      if (!isRateLimited(scraped) && scraped.status !== 429) {
        console.log(`OK after ${attempt} probe(s).`);
        return;
      }
    } catch (err) {
      console.log(`probe error: ${err?.message || err}`);
    }
    const waitMs = Math.min(300000, 60000 + attempt * 15000);
    console.log(`Still limited — sleep ${Math.round(waitMs / 1000)}s…`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

async function setupPuppeteer(opts) {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: !opts.headful,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const t = req.resourceType();
    if (t === "image" || t === "font" || t === "media") req.abort();
    else req.continue();
  });
  return { browser, page };
}

async function scrapePuppeteer(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
  try {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, a")];
      const b = btns.find((x) =>
        /tout accepter|accepter|accept all|j'accepte/i.test(x.innerText || ""),
      );
      b?.click();
    });
  } catch {
    /* ignore */
  }
  await page.waitForSelector("#description, h1", { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 150));
  return page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    const el = document.querySelector("#description");
    const raw = el?.innerText?.trim() || "";
    const title =
      document.querySelector("h1")?.innerText?.trim() || document.title?.trim() || "";
    return { raw, title, bodyText: bodyText.slice(0, 800), hasEl: !!el, status: 200 };
  });
}

function listCandidates(opts) {
  const files = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const candidates = [];
  for (const file of files) {
    const sku = file.replace(/\.json$/i, "");
    if (opts.sku && sku !== opts.sku) continue;
    const abs = path.join(PRODUCTS_DIR, file);
    let product;
    try {
      product = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch {
      continue;
    }
    if (!product.url) continue;
    if (!needsEnrich(product, opts)) continue;
    candidates.push({ sku, abs, product });
  }
  return candidates;
}

async function processOne(scrape, item, opts, state, counters, index, total) {
  const { sku, abs, product } = item;
  const prefix = `[${index}/${total}] ${sku}`;

  try {
    let scraped = await scrape(product.url);

    let rlTries = 0;
    while (isRateLimited(scraped) && rlTries < 5) {
      rlTries++;
      counters.rateLimited++;
      const waitMs = Math.min(300000, 45000 * rlTries);
      console.log(
        `${prefix} … rate-limited, waiting ${Math.round(waitMs / 1000)}s (try ${rlTries}/5)…`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
      scraped = await scrape(product.url);
    }
    if (isRateLimited(scraped)) {
      counters.failed++;
      console.log(
        `${prefix} … rate limit persists — stopping run (resume later with --wait-ok)`,
      );
      if (!opts.dryRun) await saveState(state);
      const err = new Error("RATE_LIMIT_STOP");
      err.code = "RATE_LIMIT_STOP";
      throw err;
    }

    if (is404Text(scraped.bodyText) || scraped.status === 404) {
      counters.failed++;
      state.failed[sku] = {
        at: new Date().toISOString(),
        reason: "page_missing_or_no_description",
        url: product.url,
      };
      console.log(`${prefix} … FAIL (404)`);
      if (!opts.dryRun) await saveState(state);
      return;
    }

    if (!scraped.hasEl && !scraped.raw) {
      counters.failed++;
      state.failed[sku] = {
        at: new Date().toISOString(),
        reason: "no_description_element",
        url: product.url,
      };
      console.log(`${prefix} … FAIL (no #description)`);
      if (!opts.dryRun) await saveState(state);
      return;
    }

    const cleaned = cleanDescription(scraped.raw);
    if (!cleaned || cleaned.length < 40) {
      counters.failed++;
      state.failed[sku] = {
        at: new Date().toISOString(),
        reason: "description_too_short",
        length: cleaned.length,
        url: product.url,
      };
      console.log(`${prefix} … FAIL (too short: ${cleaned.length})`);
      if (!opts.dryRun) await saveState(state);
      return;
    }

    const prev = (product.description || "").trim();
    if (cleaned === prev) {
      counters.unchanged++;
      state.done[sku] = {
        at: new Date().toISOString(),
        length: cleaned.length,
        unchanged: true,
      };
      delete state.failed[sku];
      console.log(`${prefix} … same (${cleaned.length} chars)`);
      if (!opts.dryRun) {
        product.descriptionEnrichedAt = new Date().toISOString();
        product.descriptionSource = "fiche";
        fs.writeFileSync(abs, JSON.stringify(product, null, 2) + "\n", "utf8");
        await saveState(state);
      }
      return;
    }

    if (SEO_RE.test(cleaned) && cleaned.length <= prev.length) {
      counters.skipped++;
      console.log(`${prefix} … skip (still SEO)`);
      return;
    }

    console.log(`${prefix} … ${prev.length} → ${cleaned.length} chars`);
    if (!opts.dryRun) {
      product.description = cleaned;
      product.descriptionEnrichedAt = new Date().toISOString();
      product.descriptionSource = "fiche";
      product.descriptionPrevious = prev.slice(0, 500);
      fs.writeFileSync(abs, JSON.stringify(product, null, 2) + "\n", "utf8");
      state.done[sku] = {
        at: new Date().toISOString(),
        length: cleaned.length,
        previousLength: prev.length,
      };
      delete state.failed[sku];
      await saveState(state);
    }
    counters.ok++;
  } catch (err) {
    counters.failed++;
    state.failed[sku] = {
      at: new Date().toISOString(),
      reason: String(err?.message || err).slice(0, 200),
      url: product.url,
    };
    console.log(`${prefix} … ERR ${err?.message || err}`);
    if (!opts.dryRun) await saveState(state);
  } finally {
    if (opts.delayMs > 0) await new Promise((r) => setTimeout(r, opts.delayMs));
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const state = loadState();

  // Soft failures are always retryable
  let candidates = listCandidates(opts);
  if (!opts.force && !opts.sku) {
    candidates = candidates.filter((c) => {
      if (state.done[c.sku]) return false;
      const fail = state.failed[c.sku];
      if (fail && fail.reason === "description_too_short") return false;
      if (fail && fail.reason === "page_missing_or_no_description") return false;
      return true;
    });
  }
  if (opts.limit > 0) candidates = candidates.slice(0, opts.limit);

  console.log(
    `Candidates: ${candidates.length} (mode=${opts.puppeteer ? "puppeteer" : "http"}, concurrency=${opts.concurrency}, delay=${opts.delayMs}ms)`,
  );
  if (!candidates.length) {
    console.log("Nothing to enrich.");
    return;
  }

  if (opts.waitOk) {
    await waitUntilOk(candidates[0].product.url);
  }

  const counters = { ok: 0, skipped: 0, failed: 0, unchanged: 0, rateLimited: 0 };
  let browser = null;
  let scrape;

  if (opts.puppeteer) {
    const pages = [];
    const setup = await setupPuppeteer(opts);
    browser = setup.browser;
    pages.push(setup.page);
    for (let i = 1; i < opts.concurrency; i++) {
      const extra = await setupPuppeteer(opts);
      pages.push(extra.page);
    }
    let nextPage = 0;
    scrape = async (url) => {
      const page = pages[nextPage % pages.length];
      nextPage++;
      return scrapePuppeteer(page, url);
    };
  } else {
    scrape = scrapeHttp;
  }

  let nextIndex = 0;
  const total = candidates.length;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= candidates.length) break;
      await processOne(scrape, candidates[i], opts, state, counters, i + 1, total);
    }
  }

  try {
    const workers = Array.from({ length: opts.concurrency }, () => worker());
    await Promise.all(workers);
    await stateWriteChain;
  } catch (err) {
    if (err?.code === "RATE_LIMIT_STOP" || err?.message === "RATE_LIMIT_STOP") {
      await stateWriteChain.catch(() => {});
      console.log(
        `\nStopped on rate limit. updated=${counters.ok} unchanged=${counters.unchanged} failed=${counters.failed} rateLimitedHits=${counters.rateLimited}`,
      );
      console.log("Resume later: npm run descriptions:enrich");
      return;
    }
    throw err;
  } finally {
    await stateWriteChain.catch(() => {});
    if (browser) await browser.close();
  }

  console.log(
    `\nDone. updated=${counters.ok} unchanged=${counters.unchanged} skipped=${counters.skipped} failed=${counters.failed} rateLimitedHits=${counters.rateLimited}` +
      (opts.dryRun ? " (dry-run)" : ""),
  );
  if (!opts.dryRun && counters.ok > 0) {
    console.log("Next: npm run descriptions:sync && npm run rag:index");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
