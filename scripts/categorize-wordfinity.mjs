import fs from 'node:fs/promises';
import { pipeline, env } from '@xenova/transformers';

const DICTIONARY = 'data/wordfinity-nouns.json';
const INDEX = 'index.html';
const OUTPUT = 'data/wordfinity-categories.json';
const REVIEW = 'data/wordfinity-category-review.json';
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const BATCH_SIZE = 48;
const REVIEW_MARGIN = 0.025;
const REVIEW_SCORE = 0.30;

env.allowLocalModels = false;
env.useBrowserCache = false;

const source = await fs.readFile(INDEX, 'utf8');
const profileStart = source.indexOf('categoryProfiles: [');
const profileEnd = source.indexOf('\\n      ],\\n      async loadDictionary', profileStart);
if (profileStart < 0 || profileEnd < 0) throw new Error('categoryProfiles konnten nicht aus index.html gelesen werden');
const profileText = source.slice(profileStart, profileEnd);
const profiles = [...profileText.matchAll(/\\{\\s*name: '([^']+)', description: '([^']*)' \\}/g)]
  .map(match => ({ name: match[1], description: match[2] }));
if (profiles.length < 15) throw new Error(`Zu wenige Kategorien erkannt: ${profiles.length}`);

const rawWords = JSON.parse(await fs.readFile(DICTIONARY, 'utf8'));
const unique = new Map();
for (const value of rawWords) {
  const word = String(value).trim().normalize('NFC');
  if (!/^[A-Za-zÄÖÜäöüß-]{2,}$/.test(word)) continue;
  const key = word.toLocaleLowerCase('de-DE');
  if (!unique.has(key)) unique.set(key, word);
}
const words = [...unique.entries()];
if (words.length < 10000) throw new Error(`Wörterbuch unerwartet klein: ${words.length}`);

console.log(`Lade ${MODEL}; ${words.length} eindeutige Wörter, ${profiles.length} Kategorien.`);
const extractor = await pipeline('feature-extraction', MODEL);
const profileOutput = await extractor(profiles.map(p => p.description), { pooling: 'mean', normalize: true });
const dims = profileOutput.dims;
const width = dims[dims.length - 1];
const profileVectors = profiles.map((_, i) => Array.from(profileOutput.data.slice(i * width, (i + 1) * width)));

const categories = {};
const review = [];
for (let offset = 0; offset < words.length; offset += BATCH_SIZE) {
  const batch = words.slice(offset, offset + BATCH_SIZE);
  const output = await extractor(batch.map(([, word]) => word), { pooling: 'mean', normalize: true });
  for (let i = 0; i < batch.length; i++) {
    const vector = output.data.subarray(i * width, (i + 1) * width);
    const scores = profileVectors.map((profile, index) => {
      let score = 0;
      for (let k = 0; k < width; k++) score += vector[k] * profile[k];
      return { category: profiles[index].name, score };
    }).sort((a, b) => b.score - a.score);
    const [key, word] = batch[i];
    categories[key] = scores[0].category;
    const margin = scores[0].score - scores[1].score;
    if (margin < REVIEW_MARGIN || scores[0].score < REVIEW_SCORE) {
      review.push({ word, category: scores[0].category, score: Number(scores[0].score.toFixed(4)), alternative: scores[1].category, alternativeScore: Number(scores[1].score.toFixed(4)), margin: Number(margin.toFixed(4)) });
    }
  }
  if ((offset / BATCH_SIZE) % 20 === 0 || offset + BATCH_SIZE >= words.length) {
    console.log(`Kategorisiert: ${Math.min(offset + BATCH_SIZE, words.length)}/${words.length}; Prüfbedarf: ${review.length}`);
  }
}

await fs.writeFile(OUTPUT, JSON.stringify({ model: MODEL, profileCount: profiles.length, wordCount: words.length, categories }, null, 2) + '\\n');
await fs.writeFile(REVIEW, JSON.stringify({ threshold: { margin: REVIEW_MARGIN, topScore: REVIEW_SCORE }, count: review.length, items: review }, null, 2) + '\\n');
console.log(`Fertig: ${words.length} Wörter zugeordnet; ${review.length} Fälle zur manuellen Prüfung markiert.`);
