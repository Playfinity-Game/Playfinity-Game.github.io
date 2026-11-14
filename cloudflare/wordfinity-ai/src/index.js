const TEXT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const EMBEDDING_MODEL = "@cf/baai/bge-m3";

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
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

function generatedText(result) {
  if (typeof result === "string") return result;
  const content = result?.choices?.[0]?.message?.content ?? result?.content;
  if (Array.isArray(content)) {
    return content.map(part => typeof part === "string" ? part : part?.text || "").join("\n");
  }
  return result?.response
    ?? result?.output_text
    ?? result?.text
    ?? result?.result?.response
    ?? result?.result?.output_text
    ?? (typeof content === "string" ? content : "");
}

function cleanSingleLine(value, maxLength = 60) {
  return String(value || "")
    .replace(/[`*_#]/g, "")
    .split(/\r?\n/)[0]
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, "")
    .replace(/^\s*(wort|kategorie)\s*:\s*/i, "")
    .trim()
    .slice(0, maxLength);
}

async function generate(env, system, user, maxTokens = 80) {
  const result = await env.AI.run(TEXT_MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_completion_tokens: maxTokens,
    temperature: 0.7,
    chat_template_kwargs: { enable_thinking: false }
  });
  return generatedText(result);
}

async function handleSimilarity(env, body) {
  const target = String(body.target || "").trim();
  const guess = String(body.guess || "").trim();
  if (!target || !guess) return json({ error: "target und guess sind erforderlich" }, 400);
  const result = await env.AI.run(EMBEDDING_MODEL, { text: [target, guess] });
  if (!Array.isArray(result?.data) || result.data.length < 2) {
    throw new Error("Das Embedding-Modell hat keine gültigen Vektoren geliefert");
  }
  return json({ similarity: cosine(result.data[0], result.data[1]), model: EMBEDDING_MODEL });
}

async function handleWord(env, body) {
  const excluded = Array.isArray(body.exclude)
    ? body.exclude.slice(-300).map(x => String(x).toLocaleLowerCase("de-DE"))
    : [];
  const text = await generate(
    env,
    "Du bist ein Generator für ein deutsches Wort-Ratespiel. Gib ausschließlich genau EIN bekanntes, konkretes deutsches Substantiv im Singular aus. Bevorzuge alltägliche Dinge, Tiere, Lebensmittel, Orte oder Gegenstände. Erlaubt sind gebräuchliche zusammengesetzte Wörter. Keine Fantasiewörter, Fachbegriffe, Eigennamen, Erklärungen oder Satzzeichen.",
    "Erzeuge ein neues, abwechslungsreiches deutsches Substantiv. Nicht verwenden: " + excluded.join(", ") + ". Antworte nur mit dem Wort.",
    24
  );
  const word = cleanSingleLine(text, 40).replace(/[.!?,;:]+$/g, "").trim();
  if (!/^[A-Za-zÄÖÜäöüß]+(?:[ -][A-Za-zÄÖÜäöüß]+)*$/.test(word) || word.length < 3) {
    throw new Error("Die Wort-KI hat kein gültiges deutsches Substantiv geliefert");
  }
  if (excluded.includes(word.toLocaleLowerCase("de-DE"))) {
    throw new Error("Die Wort-KI hat ein bereits verwendetes Wort geliefert");
  }
  return json({ word });
}

async function handleCategory(env, body) {
  const target = String(body.target || "").trim();
  if (!target) return json({ error: "target ist erforderlich" }, 400);
  const allowed = [
    "Tiere", "Pflanzen & Natur", "Lebensmittel & Getränke", "Kleidung & Schuhe",
    "Sport & Freizeit", "Werkzeuge & Handwerk", "Fahrzeuge & Verkehr",
    "Technik & Elektronik", "Haushalt & Möbel", "Gebäude & Architektur",
    "Orte & Geografie", "Berufe", "Körper & Gesundheit", "Musik & Instrumente",
    "Kunst & Kultur", "Spiele & Spielzeug", "Schule & Wissen",
    "Wetter & Jahreszeiten", "Weltraum & Astronomie", "Materialien & Rohstoffe"
  ];
  const text = await generate(
    env,
    "Du ordnest deutsche Substantive für ein Wort-Ratespiel EINER Oberkategorie zu. Wähle ausschließlich exakt eine Kategorie aus dieser Liste: " + allowed.join("; ") + ". Die Kategorie beschreibt WAS das Ding ist, nicht wofür oder wo man es benutzt. Niemals Formulierungen wie 'beim Wandern', 'für den Garten', 'zum Kochen' oder eine Tätigkeit. Keine Unterkategorie, kein Beispielsatz, keine Erklärung. Antworte nur mit dem exakten Kategorienamen.",
    "Wort: " + target + "\nPassende Oberkategorie aus der Liste:",
    40
  );
  const raw = cleanSingleLine(text, 60).replace(/[.!?,;:]+$/g, "").trim();
  const category = allowed.find(item => item.toLocaleLowerCase("de-DE") === raw.toLocaleLowerCase("de-DE"));
  if (!category) throw new Error("Die KI hat keine Kategorie aus der erlaubten Liste geliefert");
  return json({ category });
}

async function handleHints(env, body) {
  const target = String(body.target || "").trim();
  if (!target) return json({ error: "target ist erforderlich" }, 400);
  const excluded = new Set(
    (Array.isArray(body.excluded) ? body.excluded : [])
      .map(x => String(x).trim().toLocaleLowerCase("de-DE"))
      .filter(Boolean)
  );
  excluded.add(target.toLocaleLowerCase("de-DE"));

  const text = await generate(
    env,
    "Du hilfst bei einem deutschen semantischen Wort-Ratespiel. Erzeuge 18 unterschiedliche, gebräuchliche deutsche Einzelwörter, die inhaltlich eng mit dem Zielwort verwandt sind. Keine Umschreibungen, keine Wortgruppen, keine Sätze, keine Fantasiewörter und keine seltenen Fachbegriffe. Gib ausschließlich ein Wort pro Zeile aus, ohne Nummerierung oder Zusatztext.",
    "Zielwort: " + target + "\nBereits ausgeschlossen (diese und ähnliche Schreibweisen nicht nennen): " + [...excluded].slice(0, 100).join(", ") + "\nErzeuge jetzt 18 passende, verschiedene Wörter, eins pro Zeile.",
    220
  );

  let candidates = [];
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) candidates = parsed;
    }
  } catch (_) {}
  if (!candidates.length) {
    candidates = text.split(/[\n,;]/).map(x => x.replace(/^\s*[-*\d.)"]+|["']\s*$/g, "").trim());
  }

  const seen = new Set(excluded);
  candidates = candidates
    .map(x => String(x || "").normalize("NFC").trim())
    .filter(x => /^[A-Za-zÄÖÜäöüß-]{3,32}$/.test(x))
    .filter(x => {
      const key = x.toLocaleLowerCase("de-DE");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 18);

  if (!candidates.length) throw new Error("Die Tipp-KI hat keine gültigen Wörter geliefert");
  const embedded = await env.AI.run(EMBEDDING_MODEL, { text: [target, ...candidates] });
  if (!Array.isArray(embedded?.data) || embedded.data.length < candidates.length + 1) {
    throw new Error("Das Embedding-Modell konnte die Tipps nicht bewerten");
  }
  const hints = candidates
    .map((word, i) => ({ word, similarity: cosine(embedded.data[0], embedded.data[i + 1]) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
  return json({ hints, model: EMBEDDING_MODEL });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/health") {
      return json({ status: "ok", service: "wordfinity-ai" });
    }
    if (request.method !== "POST") return json({ error: "Methode nicht erlaubt" }, 405);

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Ungültiger JSON-Request" }, 400);
    }

    if (!env?.AI) return json({ error: "Cloudflare Workers AI Binding 'AI' fehlt" }, 503);
    try {
      switch (url.pathname) {
        case "/api/similarity": return await handleSimilarity(env, body);
        case "/api/hints": return await handleHints(env, body);
        case "/api/category": return await handleCategory(env, body);
        case "/api/word": return await handleWord(env, body);
        default: return json({ error: "Endpunkt nicht gefunden" }, 404);
      }
    } catch (error) {
      console.error("[WORDFINITY AI]", error);
      return json({ error: error?.message || "Interner KI-Fehler" }, 500);
    }
  }
};
