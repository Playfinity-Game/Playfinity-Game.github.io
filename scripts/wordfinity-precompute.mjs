#!/usr/bin/env node
/**
 * Precomputes Wordfinity BGE-M3 embeddings and top-750 semantic ranks.
 *
 * Usage:
 *   WORDFINITY_PRECOMPUTE_TOKEN=... node scripts/wordfinity-precompute.mjs all
 *   ... node scripts/wordfinity-precompute.mjs embeddings
 *   ... node scripts/wordfinity-precompute.mjs rankings
 *   ... node scripts/wordfinity-precompute.mjs target Apfel
 *
 * Run from the repository root. Embeddings are created for every unique word
 * first; ranking jobs then run category by category against the full dictionary.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const WORKER = (process.env.WORDFINITY_WORKER_URL || "https://wordfinity-ai.sdinaj9206.workers.dev").replace(/\/+$/, "");
const TOKEN = process.env.WORDFINITY_PRECOMPUTE_TOKEN;
const MODE = process.argv[2] || "all";
const TARGET_INPUT = MODE === "target" ? process.argv[3] : null;
const DICTIONARY_PATH = (MODE === "target" ? process.argv[4] : process.argv[3]) || "test/data/wordfinity-nouns.json";
const BATCH_SIZE = 32;

if (!TOKEN) throw new Error("WORDFINITY_PRECOMPUTE_TOKEN fehlt.");
if (!["all", "embeddings", "rankings", "target"].includes(MODE)) {
  throw new Error("Modus muss all, embeddings, rankings oder target sein.");
}
if (MODE === "target" && !TARGET_INPUT) {
  throw new Error("Bitte ein Zielwort angeben, z. B. target Apfel.");
}

const raw = await readFile(DICTIONARY_PATH);
const dictionarySha = createHash("sha256").update(raw).digest("hex");
const grouped = JSON.parse(raw.toString("utf8"));
const seen = new Set();
const categories = [];

for (const [category, values] of Object.entries(grouped)) {
  if (!Array.isArray(values)) throw new Error("Ungültige Kategorie: " + category);
  const words = [];
  for (const value of values) {
    const word = String(value || "").normalize("NFC").trim();
    const key = word.toLocaleLowerCase("de-DE");
    if (!/^[A-Za-zÄÖÜäöüß-]{2,}$/.test(word) || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  if (words.length) categories.push({ category, words });
}

const totalWords = categories.reduce((sum, item) => sum + item.words.length, 0);
console.log("Wörterbuch:", totalWords, "eindeutige Wörter in", categories.length, "Kategorien");
console.log("Dictionary SHA-256:", dictionarySha);

async function post(path, body) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(WORKER + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + TOKEN
        },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result;
      const error = new Error(result.error || "HTTP " + response.status);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 1500));
  }
  throw lastError || new Error("Worker-Anfrage fehlgeschlagen");
}

if (MODE === "all" || MODE === "embeddings" || MODE === "target") {
  let done = 0;
  for (const { category, words } of categories) {
    for (let offset = 0; offset < words.length; offset += BATCH_SIZE) {
      const batch = words.slice(offset, offset + BATCH_SIZE);
      await post("/api/admin/embeddings", {
        category,
        dictionary_sha: dictionarySha,
        words: batch
      });
      done += batch.length;
      console.log("[Embeddings]", category, done + "/" + totalWords);
    }
  }
}

if (MODE === "all" || MODE === "rankings" || MODE === "target") {
  let done = 0;
  const rankingJobs = MODE === "target"
    ? (() => {
        const wanted = TARGET_INPUT.normalize("NFC").trim().toLocaleLowerCase("de-DE");
        for (const group of categories) {
          const match = group.words.find(word => word.toLocaleLowerCase("de-DE") === wanted);
          if (match) return [{ category: group.category, words: [match] }];
        }
        throw new Error("Zielwort nicht im Wörterbuch gefunden: " + TARGET_INPUT);
      })()
    : categories;
  const rankingTotal = rankingJobs.reduce((sum, item) => sum + item.words.length, 0);
  for (const { category, words } of rankingJobs) {
    console.log("[Ranglisten] Starte Kategorie:", category, "(" + words.length + " Wörter)");
    for (const target_word of words) {
      await post("/api/admin/rank", {
        target_word,
        dictionary_sha: dictionarySha
      });
      done++;
      if (done % 10 === 0 || done === rankingTotal) {
        console.log("[Ranglisten]", category, done + "/" + rankingTotal);
      }
    }
  }
}

console.log(MODE === "target"
  ? "Einzeltest abgeschlossen. Es wurde nur die Rangliste für " + TARGET_INPUT + " berechnet."
  : "Wordfinity-Vorberechnung abgeschlossen.");
