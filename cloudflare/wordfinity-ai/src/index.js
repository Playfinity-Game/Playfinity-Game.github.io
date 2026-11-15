const HF_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const HF_URL = "https://router.huggingface.co/hf-inference/models/" + HF_MODEL + "/pipeline/feature-extraction";
const TARGET_COUNT = 8213;
// Warm isolate cache: the 8,213 dictionary vectors are reused across puzzles.
const EMBEDDING_CACHE = new Map();
const CATEGORIES = [
  { name: "Menschen & Berufe", description: "Menschen, Personen, Berufe, Tätigkeiten und soziale Rollen" },
  { name: "Tiere & Pflanzen", description: "Tiere, Pflanzen, Bäume, Blumen und Pilze" },
  { name: "Natur & Wetter", description: "Natur, Landschaften, Wetter, Klima und Jahreszeiten" },
  { name: "Essen & Trinken", description: "Lebensmittel, Speisen, Zutaten, Getränke und Kochen" },
  { name: "Haushalt & Wohnen", description: "Haushalt, Möbel, Räume, Wohnen und Einrichtung" },
  { name: "Werkzeug & Gegenstände", description: "Werkzeuge, Alltagsgegenstände, Geräte und Materialien" },
  { name: "Technik & Elektronik", description: "Technik, Elektronik, Computer, Maschinen und digitale Geräte" },
  { name: "Orte & Gebäude", description: "Orte, Gebäude, Bauwerke, Räume und Einrichtungen" },
  { name: "Kleidung & Mode", description: "Kleidung, Schuhe, Stoffe, Accessoires und Mode" },
  { name: "Fahrzeuge & Reisen", description: "Fahrzeuge, Verkehrsmittel, Reisen und Transport" },
  { name: "Sport & Spiele", description: "Sportarten, Bewegung, Spiel, Spielzeug und Freizeitaktivitäten" },
  { name: "Kunst, Musik & Kultur", description: "Kunst, Musik, Instrumente, Theater, Kultur und Kreativität" },
  { name: "Sprache & Medien", description: "Sprache, Wörter, Bücher, Presse, Film und Medien" },
  { name: "Körper & Gesundheit", description: "Körperteile, Gesundheit, Medizin und Wohlbefinden" },
  { name: "Wissenschaft & Weltall", description: "Wissenschaft, Forschung, Mathematik, Weltall und Astronomie" },
  { name: "Geld, Recht & Gesellschaft", description: "Geld, Wirtschaft, Recht, Politik und Gesellschaft" }
];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}
function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}
async function embed(env, inputs) {
  if (!env.HF_API_TOKEN) throw new Error("HF_API_TOKEN fehlt als Worker-Secret");
  const keys = inputs.map(value => String(value).normalize("NFC").trim().toLocaleLowerCase("de-DE"));
  const missing = [];
  const missingKeys = new Set();
  for (let i = 0; i < keys.length; i++) {
    if (!EMBEDDING_CACHE.has(keys[i]) && !missingKeys.has(keys[i])) {
      missing.push(String(inputs[i]));
      missingKeys.add(keys[i]);
    }
  }
  if (missing.length) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(HF_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + env.HF_API_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: missing, options: { wait_for_model: true } })
      });
      if (response.status === 503 && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        lastError = new Error("HuggingFace HTTP " + response.status + ": " + detail);
        if (response.status >= 500 && attempt < 2) { await new Promise(resolve => setTimeout(resolve, 3000)); continue; }
        throw lastError;
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length !== missing.length || !data.every(v => Array.isArray(v) && v.length)) {
        throw new Error("HuggingFace lieferte ungültige Embeddings");
      }
      for (let i = 0; i < data.length; i++) {
        const key = missingKeys.values().next().value;
        // Preserve the original missing-input order, including duplicate spellings.
        const originalKey = keys.find((candidate, index) => !EMBEDDING_CACHE.has(candidate) && String(inputs[index]).normalize("NFC").trim().toLocaleLowerCase("de-DE") === candidate);
        EMBEDDING_CACHE.set(originalKey || key, data[i]);
        missingKeys.delete(originalKey || key);
      }
      break;
    }
    if (missingKeys.size) throw lastError || new Error("HuggingFace-Inferenz nicht abgeschlossen");
  }
  // Bound memory use while keeping the entire target dictionary warm in a live isolate.
  while (EMBEDDING_CACHE.size > 10000) EMBEDDING_CACHE.delete(EMBEDDING_CACHE.keys().next().value);
  return keys.map(key => EMBEDDING_CACHE.get(key));
}
async function handleSimilarity(env, body) {
  const target = String(body.target || "").trim(), guess = String(body.guess || "").trim();
  if (!target || !guess) return json({ error: "target und guess sind erforderlich" }, 400);
  const vectors = await embed(env, [target, guess]);
  return json({ similarity: cosine(vectors[0], vectors[1]), model: HF_MODEL });
}
async function handleCategory(env, body) {
  const word = String(body.target || "").trim();
  if (!word) return json({ error: "target ist erforderlich" }, 400);
  const vectors = await embed(env, [word, ...CATEGORIES.map(c => c.description)]);
  const ranked = CATEGORIES.map((c, i) => ({ category: c.name, score: cosine(vectors[0], vectors[i + 1]) }))
    .sort((a, b) => b.score - a.score);
  const margin = ranked[0].score - ranked[1].score;
  const needsReview = ranked[0].score < 0.20 || margin < 0.015;
  return json({
    category: needsReview ? null : ranked[0].category,
    needsReview,
    candidates: ranked.slice(0, 3),
    model: HF_MODEL
  });
}
async function handleRanking(env, body) {
  const target = String(body.target || "").trim();
  const words = Array.isArray(body.words) ? body.words : [];
  if (!target) return json({ error: "target ist erforderlich" }, 400);
  if (words.length !== TARGET_COUNT || new Set(words.map(w => String(w).toLocaleLowerCase("de-DE"))).size !== TARGET_COUNT) {
    return json({ error: "Es werden exakt 8.213 eindeutige Zielwörter erwartet" }, 400);
  }
  const targetVector = (await embed(env, [target]))[0];
  const scores = new Array(words.length);
  const batchSize = 96;
  const batches = [];
  for (let offset = 0; offset < words.length; offset += batchSize) batches.push(offset);
  let cursor = 0;
  async function worker() {
    while (true) {
      const offset = cursor;
      cursor += batchSize;
      if (offset >= words.length) return;
      const batch = words.slice(offset, offset + batchSize).map(String);
      const vectors = await embed(env, batch);
      for (let i = 0; i < batch.length; i++) scores[offset + i] = { word: batch[i], similarity: cosine(targetVector, vectors[i]) };
    }
  }
  await Promise.all(Array.from({ length: 3 }, () => worker()));
  scores.sort((a, b) => b.similarity - a.similarity || a.word.localeCompare(b.word, "de"));
  return json({ target, model: HF_MODEL, count: scores.length, ranking: scores });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/health") {
      return json({ status: "ok", service: "wordfinity-ai", model: HF_MODEL, categories: CATEGORIES.map(c => c.name) });
    }
    if (request.method !== "POST") return json({ error: "Methode nicht erlaubt" }, 405);
    let body;
    try { body = await request.json(); } catch (_) { return json({ error: "Ungültiger JSON-Request" }, 400); }
    try {
      switch (url.pathname) {
        case "/api/similarity": return await handleSimilarity(env, body);
        case "/api/category": return await handleCategory(env, body);
        case "/api/ranking": return await handleRanking(env, body);
        default: return json({ error: "Endpunkt nicht gefunden" }, 404);
      }
    } catch (error) {
      console.error("[WORDFINITY HF]", error);
      return json({ error: error?.message || "HuggingFace-Inferenzfehler" }, 502);
    }
  }
};
