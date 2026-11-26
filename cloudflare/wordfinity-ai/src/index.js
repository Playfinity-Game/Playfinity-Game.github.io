import WORDS_BY_CATEGORY from "../../../data/wordfinity-nouns.json";

const TEXT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const EMBEDDING_MODEL = "@cf/baai/bge-m3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

async function generate(env, system, user, maxTokens = 80, temperature = 0.7) {
  const result = await env.AI.run(TEXT_MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_completion_tokens: maxTokens,
    temperature,
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


async function handleSemanticSimilarity(env, body) {
  const target = String(body.target || "").normalize("NFC").trim();
  const guess = String(body.guess || "").normalize("NFC").trim();
  if (!target || !guess) return json({ error: "target und guess sind erforderlich" }, 400);
  if (target.length > 80 || guess.length > 80) {
    return json({ error: "target und guess dürfen höchstens 80 Zeichen lang sein" }, 400);
  }

  const raw = await generate(
    env,
    "Du bist ein präziser deutscher Lexikograf für ein Wort-Assoziationsspiel. Beschreibe die Bedeutungen der angegebenen Wörter unabhängig voneinander. Beschreibe jeweils, was das Wort bezeichnet, seine typische Oberkategorie, Eigenschaften und übliche Zusammenhänge. Schreibe konkrete, sachliche Bedeutungsbeschreibungen, keine Definition durch bloße Wiederholung des Wortes. Erfinde keine Beziehungen zwischen den beiden Wörtern und bewerte ihre Ähnlichkeit nicht. Gib ausschließlich valides JSON als Array aus: [{\"word\":\"...\",\"description\":\"...\"}]. Übernimm beide Wörter exakt.",
    "Wörter: " + JSON.stringify([target, guess]) + "\nErstelle für jedes Wort eine eigenständige Beschreibung auf Deutsch mit 1 bis 3 kurzen Sätzen. Verwende bei mehrdeutigen Wörtern die gebräuchlichste Alltagsbedeutung.",
    700
  );

  let parsed;
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch (_) {}
  if (!Array.isArray(parsed)) {
    throw new Error("Die Bedeutungs-KI hat keine gültigen Beschreibungen geliefert");
  }
  const byWord = new Map(parsed.map(item => [
    String(item?.word || "").normalize("NFC").trim().toLocaleLowerCase("de-DE"),
    String(item?.description || "").trim()
  ]));
  const targetDescription = byWord.get(target.toLocaleLowerCase("de-DE"));
  const guessDescription = byWord.get(guess.toLocaleLowerCase("de-DE"));
  if (!targetDescription || !guessDescription ||
      targetDescription.length < 20 || guessDescription.length < 20 ||
      targetDescription.length > 700 || guessDescription.length > 700) {
    throw new Error("Die Bedeutungs-KI hat unvollständige Beschreibungen geliefert");
  }

  const embedded = await env.AI.run(EMBEDDING_MODEL, {
    text: [targetDescription, guessDescription]
  });
  if (!Array.isArray(embedded?.data) || embedded.data.length < 2) {
    throw new Error("Das Embedding-Modell konnte die Bedeutungen nicht vergleichen");
  }
  return json({
    similarity: cosine(embedded.data[0], embedded.data[1]),
    model: EMBEDDING_MODEL,
    method: "gemma-meaning-descriptions+bge-m3",
    target_description: targetDescription,
    guess_description: guessDescription
  });
}


async function handleSemanticJudgement(env, body) {
  const target = String(body.target || "").normalize("NFC").trim();
  const guess = String(body.guess || "").normalize("NFC").trim();
  if (!target || !guess) return json({ error: "target und guess sind erforderlich" }, 400);
  if (target.length > 80 || guess.length > 80) {
    return json({ error: "target und guess dürfen höchstens 80 Zeichen lang sein" }, 400);
  }
  if (target.toLocaleLowerCase("de-DE") === guess.toLocaleLowerCase("de-DE")) {
    return json({ similarity: 1, score: 100, relation: "identisch", reason: "Dasselbe Wort.", method: "gemma-direct-semantic-judgement" });
  }

  const raw = await generate(
    env,
    "Du bist ein alltagsbezogener Bedeutungsbewerter für ein deutsches Wort-Assoziationsspiel. Bewerte die inhaltliche Nähe zweier Begriffe so, wie ein aufmerksamer Mensch ihre Beziehung im Alltag versteht. Berücksichtige nicht nur Synonyme und gemeinsame Kategorien, sondern auch Ober-/Unterbegriffe, typische Bestandteile, Teil-Ganzes-Beziehungen, gemeinsame Funktionen, typische gemeinsame Verwendung, typische Umgebungen und Zutaten. Entscheidend ist die Stärke und Direktheit der Beziehung: Eine definierende oder sehr typische Beziehung darf sehr hoch bewertet werden; eine bloß mögliche oder zufällige gemeinsame Situation deutlich niedriger. Unterscheide insbesondere: (1) identische Bedeutung oder nahezu austauschbare Synonyme, (2) Oberbegriff und typischer Unterbegriff, (3) eng verwandte Dinge derselben vertrauten Alltagsgruppe, (4) direkte Bestandteile sowie prägende Teil-Ganzes- oder Kollektivbeziehungen, (5) Dinge, die typischerweise gemeinsam benutzt oder für dieselbe Tätigkeit kombiniert werden, (6) Dinge derselben breiteren Sachgruppe, (7) bloße thematische oder situative Assoziationen. Bewertungsanker: 100 = identisch; 95-99 = nahezu synonym oder ein sehr präziser Oberbegriff mit eindeutigem Unterbegriff; 85-94 = sehr enge Alltagsbeziehung, enge Verwandtschaft oder prägende Teil-Ganzes-Beziehung; 75-84 = klar eng verwandte Dinge oder ein typischer direkter Bestandteil; 60-74 = gleiche größere Kategorie oder deutlicher typischer Zusammenhang; 45-59 = nachvollziehbare, aber eher indirekte Verwendung, Umgebung oder Zutatenbeziehung; 25-44 = lockere Assoziation; 0-24 = kaum oder keine sinnvolle Beziehung. Nutze die Bereiche flexibel und differenziert: Ein typischer, direkter Bestandteil ist stärker als ein bloß möglicher Bestandteil. Ein häufig gemeinsam verwendetes Gegenstandspaar kann sehr nah sein, wenn die gemeinsame Funktion im Alltag prägend ist; bloße Koexistenz reicht nicht. Ein Kollektiv oder Ganzes, das typischerweise aus dem Zielbegriff besteht, kann sehr nah sein. Ein präziser Oberbegriff kann sehr nah sein, auch wenn er breiter ist. Gleiche Oberkategorie allein rechtfertigt keine extrem hohe Bewertung. Eine typische Zutat oder ein typisches Rezept kann eine mittlere bis hohe Beziehung ergeben, aber nicht automatisch Synonymnähe. Bewerte die Beziehung in beide Richtungen symmetrisch. Wende dieselben Maßstäbe auf alle Themengebiete an. Erfinde keine Fakten, keine taxonomischen Aussagen und keine Assoziationsketten. Verwende fachlich korrekte Bezeichnungen: Ein Mitglied einer Oberkategorie ist nicht automatisch eine taxonomische Unterart. Begründe die konkrete Beziehung präzise und knapp. Vergib einen ganzzahligen Wert von 0 bis 100. Gib ausschließlich valides JSON in genau dieser Form aus: {\"score\": 0, \"relation\": \"kurze Beziehungsart\", \"reason\": \"kurze deutsche Begründung\"}. Die Begründung muss sich ausdrücklich auf Zielwort und Ratewort beziehen und höchstens 12 Wörter haben.",
    "Zielwort: " + JSON.stringify(target) + "\nRatewort: " + JSON.stringify(guess) + "\nBewerte jetzt ihre Bedeutungsnähe anhand der Skala. Die Begründung darf höchstens 12 Wörter haben.",
    160,
    0.1
  );

  let judgement;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) judgement = JSON.parse(match[0]);
  } catch (_) {}
  const score = Number(judgement?.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("Die Bedeutungs-KI hat keinen gültigen Ähnlichkeitswert geliefert");
  }
  const relation = String(judgement?.relation || "semantische Beziehung").trim().slice(0, 60);
  const reason = String(judgement?.reason || "").trim().slice(0, 180);
  return json({
    similarity: score / 100,
    score,
    relation,
    reason,
    model: TEXT_MODEL,
    method: "gemma-direct-semantic-judgement"
  });
}


function supabaseHeaders(env, prefer = "") {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    "apikey": key,
    "Authorization": "Bearer " + key,
    "Content-Type": "application/json",
    ...(prefer ? { "Prefer": prefer } : {})
  };
}

function secureTokenMatch(expected, supplied) {
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}

function requirePrecomputeAuth(request, env) {
  const supplied = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  return secureTokenMatch(env.WORDFINITY_PRECOMPUTE_TOKEN, supplied);
}

function validDictionarySha(value) {
  return typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value);
}

async function supabaseRequest(env, path, init = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase ist im Wordfinity-Worker noch nicht konfiguriert");
  }
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const response = await fetch(base + "/rest/v1/" + path, {
    ...init,
    headers: { ...supabaseHeaders(env, init.prefer || ""), ...(init.headers || {}) }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok) {
    console.error("[WORDFINITY SUPABASE]", response.status, raw.slice(0, 1200));
    throw new Error("Supabase-Anfrage fehlgeschlagen (" + response.status + ")");
  }
  return data;
}

async function handlePrecomputeEmbeddings(request, env, body) {
  if (!requirePrecomputeAuth(request, env)) return json({ error: "Nicht autorisiert" }, 401);
  const category = String(body.category || "").trim();
  const dictionarySha = String(body.dictionary_sha || "").toLowerCase();
  const words = Array.isArray(body.words)
    ? [...new Map(body.words.map(value => {
        const word = String(value || "").normalize("NFC").trim();
        return [word.toLocaleLowerCase("de-DE"), word];
      }).filter(([key, word]) => key && /^[A-Za-zÄÖÜäöüß-]{2,}$/.test(word)).map(([key, word]) => [key, word])).values()]
    : [];
  if (!category || category.length > 80 || !validDictionarySha(dictionarySha) || !words.length || words.length > 32) {
    return json({ error: "category, SHA-256 und 1 bis 32 gültige Wörter sind erforderlich" }, 400);
  }
  const existingQuery = new URLSearchParams({
    select: "word_key",
    dictionary_sha: "eq." + dictionarySha,
    model: "eq." + EMBEDDING_MODEL,
    word_key: "in.(" + words.map(word => '"' + word.toLocaleLowerCase("de-DE") + '"').join(",") + ")"
  });
  const existingRows = await supabaseRequest(env, "wordfinity_word_embeddings?" + existingQuery.toString());
  const existingKeys = new Set((Array.isArray(existingRows) ? existingRows : []).map(row => row.word_key));
  const missingWords = words.filter(word => !existingKeys.has(word.toLocaleLowerCase("de-DE")));
  if (!missingWords.length) {
    return json({ stored: 0, skipped: words.length, category, model: EMBEDDING_MODEL, dictionary_sha: dictionarySha });
  }
  const embedded = await env.AI.run(EMBEDDING_MODEL, { text: missingWords });
  if (!Array.isArray(embedded?.data) || embedded.data.length !== missingWords.length) {
    throw new Error("BGE-M3 hat nicht für alle Wörter ein Embedding geliefert");
  }
  const rows = missingWords.map((word, index) => {
    const vector = embedded.data[index];
    if (!Array.isArray(vector) || vector.length !== 1024 || vector.some(value => !Number.isFinite(Number(value)))) {
      throw new Error("BGE-M3 lieferte für " + word + " keinen gültigen 1024-dimensionalen Vektor");
    }
    return {
      word_key: word.toLocaleLowerCase("de-DE"),
      word,
      category,
      dictionary_sha: dictionarySha,
      model: EMBEDDING_MODEL,
      embedding: vector,
      embedding_vector: "[" + vector.join(",") + "]"
    };
  });
  await supabaseRequest(env, "wordfinity_word_embeddings?on_conflict=word_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify(rows)
  });
  return json({ stored: rows.length, skipped: words.length - rows.length, category, model: EMBEDDING_MODEL, dictionary_sha: dictionarySha });
}


function parseDescriptionList(text, words, category) {
  let parsed;
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch (_) {}
  const byWord = new Map();
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const word = String(item?.word || "").normalize("NFC").trim().toLocaleLowerCase("de-DE");
      const description = String(item?.description || "").trim();
      if (word && description.length >= 20 && description.length <= 500) byWord.set(word, description);
    }
  }
  return words.map(word => ({
    word,
    description: byWord.get(word.toLocaleLowerCase("de-DE"))
      || (word + " ist ein gebräuchlicher Begriff aus dem Bereich " + category + ". Gemeint ist die Sache selbst mit ihren typischen Eigenschaften, Verwendungen und Zusammenhängen im Alltag.")
  }));
}

async function handlePrecomputeSemanticEmbeddings(request, env, body) {
  if (!requirePrecomputeAuth(request, env)) return json({ error: "Nicht autorisiert" }, 401);
  const category = String(body.category || "").trim();
  const dictionarySha = String(body.dictionary_sha || "").toLowerCase();
  const words = Array.isArray(body.words)
    ? [...new Map(body.words.map(value => {
        const word = String(value || "").normalize("NFC").trim();
        return [word.toLocaleLowerCase("de-DE"), word];
      }).filter(([key, word]) => key && /^[A-Za-zÄÖÜäöüß-]{2,}$/.test(word)).map(([key, word]) => [key, word])).values()]
    : [];
  if (!category || category.length > 80 || !validDictionarySha(dictionarySha) || !words.length || words.length > 32) {
    return json({ error: "category, SHA-256 und 1 bis 32 gültige Wörter sind erforderlich" }, 400);
  }

  const prompt = await generate(
    env,
    "Du bist ein Lexikograf für ein deutsches Wort-Assoziationsspiel. Erstelle für jedes angegebene deutsche Einzelwort eine sachlich korrekte, eigenständige Bedeutungsbeschreibung auf Deutsch. Beschreibe die Bedeutung des Wortes, nicht seine Schreibweise. Nenne typische Oberbegriffe, Unterarten, Eigenschaften, Funktionen, Lebensräume, Herstellung oder typische Zusammenhänge, soweit passend. Keine bloßen Wortbestandteile, keine erfundenen Fakten, keine langen Ausschweifungen. Gib ausschließlich valides JSON als Array aus: [{\"word\":\"...\",\"description\":\"...\"}]. Übernimm jedes Wort exakt.",
    "Kategorie: " + category + "\nWörter: " + JSON.stringify(words) + "\nErzeuge für jedes Wort eine Beschreibung von 1 bis 3 kurzen Sätzen. Bei mehrdeutigen Wörtern nimm die gebräuchlichste Alltagsbedeutung.",
    1800
  );
  const descriptions = parseDescriptionList(prompt, words, category);
  const embedded = await env.AI.run(EMBEDDING_MODEL, { text: descriptions.map(item => item.description) });
  if (!Array.isArray(embedded?.data) || embedded.data.length !== words.length) {
    throw new Error("BGE-M3 hat nicht für alle Bedeutungsbeschreibungen ein Embedding geliefert");
  }
  // Preserve the required original BGE-M3 embedding when updating semantic fields.
  const existingQuery = new URLSearchParams({
    select: "word_key,embedding",
    dictionary_sha: "eq." + dictionarySha,
    model: "eq." + EMBEDDING_MODEL,
    word_key: "in.(" + words.map(word => '"' + word.toLocaleLowerCase("de-DE") + '"').join(",") + ")"
  });
  const existingRows = await supabaseRequest(env, "wordfinity_word_embeddings?" + existingQuery.toString());
  const existingByKey = new Map((Array.isArray(existingRows) ? existingRows : []).map(row => [row.word_key, row.embedding]));
  const missingOriginal = words.filter(word => !existingByKey.has(word.toLocaleLowerCase("de-DE")));
  if (missingOriginal.length) {
    throw new Error("Original-Embedding fehlt für: " + missingOriginal.join(", "));
  }

  const rows = descriptions.map((item, index) => {
    const vector = embedded.data[index];
    if (!Array.isArray(vector) || vector.length !== 1024 || vector.some(value => !Number.isFinite(Number(value)))) {
      throw new Error("BGE-M3 lieferte für " + item.word + " keinen gültigen Bedeutungsvektor");
    }
    return {
      word_key: item.word.toLocaleLowerCase("de-DE"),
      word: item.word,
      category,
      dictionary_sha: dictionarySha,
      model: EMBEDDING_MODEL,
      embedding: existingByKey.get(item.word.toLocaleLowerCase("de-DE")),
      semantic_text: item.description,
      semantic_embedding_vector: "[" + vector.join(",") + "]"
    };
  });
  await supabaseRequest(env, "wordfinity_word_embeddings?on_conflict=word_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify(rows)
  });
  return json({ stored: rows.length, category, model: EMBEDDING_MODEL, dictionary_sha: dictionarySha });
}

async function handlePrecomputeTarget(request, env, body) {
  if (!requirePrecomputeAuth(request, env)) return json({ error: "Nicht autorisiert" }, 401);
  const target = String(body.target_word || "").normalize("NFC").trim();
  const dictionarySha = String(body.dictionary_sha || "").toLowerCase();
  if (!target || target.length > 80 || !validDictionarySha(dictionarySha)) {
    return json({ error: "target_word und gültiger dictionary_sha sind erforderlich" }, 400);
  }
  const result = await supabaseRequest(env, "rpc/wordfinity_compute_semantic_ranking", {
    method: "POST",
    body: JSON.stringify({ p_target_word: target, p_dictionary_sha: dictionarySha })
  });
  return json({ result });
}

async function handlePrecomputedRank(env, body) {
  const target = String(body.target || "").normalize("NFC").trim();
  const guess = String(body.guess || "").normalize("NFC").trim();
  if (!target || !guess || target.length > 80 || guess.length > 80) {
    return json({ error: "target und guess sind erforderlich" }, 400);
  }
  const targetKey = target.toLocaleLowerCase("de-DE");
  const guessKey = guess.toLocaleLowerCase("de-DE");
  if (targetKey === guessKey) {
    return json({ precomputed: true, rank: 1, similarity: 1, candidateCount: 0 });
  }
  const query = new URLSearchParams({
    select: "rankings,dictionary_sha,model,candidate_count",
    target_word: "eq." + targetKey,
    limit: "1"
  });
  const rows = await supabaseRequest(env, "wordfinity_semantic_rankings?" + query.toString());
  const entry = Array.isArray(rows) ? rows[0] : null;
  if (!entry || entry.model !== EMBEDDING_MODEL || !Array.isArray(entry.rankings)) {
    return json({ precomputed: false, rank: null });
  }
  const found = entry.rankings.find(item =>
    String(item?.word || "").normalize("NFC").toLocaleLowerCase("de-DE") === guessKey
  );
  if (!found || !Number.isInteger(Number(found.rank))) {
    return json({ precomputed: false, rank: null, candidateCount: entry.candidate_count });
  }
  return json({
    precomputed: true,
    rank: Number(found.rank),
    similarity: Number(found.similarity),
    candidateCount: Number(entry.candidate_count)
  });
}

async function handleWord(env, body) {
  // Ausschließlich die kuratierte, geprüfte Wordfinity-Zielwortliste verwenden.
  // Die semantischen Ranglisten bleiben unverändert und ranken weiterhin die Rateversuche.
  const excluded = new Set(
    (Array.isArray(body.exclude) ? body.exclude : [])
      .slice(-300)
      .map(value => String(value || "").normalize("NFC").trim().toLocaleLowerCase("de-DE"))
      .filter(Boolean)
  );
  const pool = Object.entries(WORDS_BY_CATEGORY).flatMap(([category, words]) =>
    (Array.isArray(words) ? words : []).map(word => ({
      word: String(word || "").normalize("NFC").trim(),
      category
    }))
  ).filter(item =>
    item.word.length >= 2 &&
    /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*$/.test(item.word) &&
    !excluded.has(item.word.toLocaleLowerCase("de-DE"))
  );
  if (!pool.length) {
    return json({ error: "Keine unverbrauchten geprüften Wordfinity-Zielwörter mehr verfügbar" }, 409);
  }
  // Zufällige Auswahl aus der aktiven, kategorisierten 4.064-Wörter-Liste.
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return json({ word: selected.word, category: selected.category, source: "curated-wordfinity-nouns" });
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
  const level = body.level === "mittel" ? "mittel" : "leicht";
  const requestedCount = Math.max(8, Math.min(24, Number(body.count) || 20));
  const excluded = new Set(
    (Array.isArray(body.excluded) ? body.excluded : [])
      .map(x => String(x).trim().toLocaleLowerCase("de-DE"))
      .filter(Boolean)
  );
  excluded.add(target.toLocaleLowerCase("de-DE"));

  const levelGuidance = level === "leicht"
    ? "STUFE LEICHT: Wähle gut erkennbare, hilfreiche Assoziationen. Sie dürfen dem Ziel semantisch relativ nahe sein, sollen aber nicht die Lösung, ein Synonym, eine direkte Unterart, ein typisches Geräusch oder ein unmittelbares Merkmal verraten. Beispiel Zielwort 'Hund': passende Hinweise wären 'Haustier', 'Katze' oder 'Tier'; zu direkt wären 'Welpe', 'Bellen' oder 'Hundeleine'."
    : "STUFE MITTEL: Wähle indirektere, aber weiterhin klar sinnvolle Assoziationen aus Alltag, Umfeld, Funktion, typischen Situationen oder Zusammenhängen. Der Zusammenhang soll einen kleinen Aha-Moment auslösen, nicht beliebig oder weit hergeholt sein. Beispiel Zielwort 'Hund': eher 'Spaziergang', 'Tierarzt' oder 'Futternapf' als 'Auto'; zu direkt wären 'Welpe', 'Bellen' oder 'Hundeleine'.";

  const text = await generate(
    env,
    "Du hilfst bei einem deutschen semantischen Wort-Ratespiel. Erzeuge gebräuchliche deutsche Einzelwörter als hilfreiche, indirekte Denkanstöße zum Zielwort. " + levelGuidance + " Niemals das Zielwort selbst oder Zusammensetzungen, Ableitungen, Beugungsformen oder Schreibvarianten des Zielworts oder ausgeschlossener Wörter ausgeben. Keine Wortgruppen, Sätze, Erklärungen, Fantasiewörter oder seltenen Fachbegriffe. Die Wörter dürfen außerhalb einer vorgegebenen Spielwortliste liegen. Gib ausschließlich ein Wort pro Zeile aus, ohne Nummerierung oder Zusatztext.",
    "Zielwort: " + target + "\nTippstufe: " + level + "\nBereits ausgeschlossen (diese und ähnliche Schreibweisen nicht nennen): " + [...excluded].slice(0, 100).join(", ") + "\nErzeuge jetzt " + requestedCount + " unterschiedliche, passende Denkanstöße, eins pro Zeile.",
    Math.max(160, requestedCount * 11)
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
      const key = x.toLocaleLowerCase("de-DE").replace(/[^a-zäöüß]/g, "");
      if ([...seen].some(existing => {
        const blocked = existing.replace(/[^a-zäöüß]/g, "");
        return blocked.length >= 4 && (key === blocked || key.includes(blocked) || blocked.includes(key));
      })) return false;
      seen.add(x.toLocaleLowerCase("de-DE"));
      return true;
    })
    .slice(0, requestedCount);

  if (!candidates.length) throw new Error("Die Tipp-KI hat keine gültigen Wörter geliefert");
  // Score generated hint candidates with the same everyday-relationship
  // judgement used by /api/similarity-judgement, rather than BGE-M3 cosine.
  const scoringPrompt =
    "Du bewertest Wortbeziehungen für dasselbe deutsche Alltags-Wortspiel. " +
    "Nutze eine alltagsbezogene Skala: 100 identisch; 95-99 nahezu synonym oder präziser Ober-/Unterbegriff; " +
    "85-94 sehr enge Alltagsbeziehung oder prägende Teil-Ganzes-Beziehung; " +
    "75-84 klar eng verwandte Dinge oder typischer direkter Bestandteil; " +
    "60-74 gleiche größere Kategorie oder deutlicher typischer Zusammenhang; " +
    "45-59 nachvollziehbare, eher indirekte Verwendung, Umgebung oder Zutatenbeziehung; " +
    "25-44 lockere Assoziation; 0-24 kaum Beziehung. " +
    "Berücksichtige Synonyme, Kategorien, typische Bestandteile, Teil-Ganzes, gemeinsame Funktionen, " +
    "typische gemeinsame Verwendung, typische Umgebungen und Zutaten. Häufige, prägende Alltagsbeziehungen " +
    "dürfen hoch bewertet werden; bloße Koexistenz oder nur denkbare Situationen nicht. " +
    "Wende dieselben Maßstäbe auf alle Themengebiete an. Bewerte jedes Kandidatenwort unabhängig " +
    "und symmetrisch gegenüber dem Zielwort. Erfinde keine Beziehungen. " +
    "Gib ausschließlich valides JSON als Array aus: [{\"word\":\"Kandidat\",\"score\":0}]. " +
    "Übernimm jedes Kandidatenwort exakt und gib für jedes genau einen ganzzahligen Wert von 0 bis 100 aus.";
  const scoringInput =
    "Zielwort: " + JSON.stringify(target) +
    "\nKandidaten: " + JSON.stringify(candidates) +
    "\nBewerte jetzt alle Kandidaten einzeln gegenüber dem Zielwort.";
  const scoredRaw = await generate(
    env,
    scoringPrompt,
    scoringInput,
    Math.max(240, requestedCount * 24),
    0.1
  );
  let scored;
  try {
    const match = scoredRaw.match(/\[[\s\S]*\]/);
    if (match) scored = JSON.parse(match[0]);
  } catch (_) {}
  if (!Array.isArray(scored)) {
    throw new Error("Die Alltagsbewertung konnte die Tipp-Kandidaten nicht auswerten");
  }
  const scoreByWord = new Map();
  for (const item of scored) {
    const word = String(item?.word || "").toLocaleLowerCase("de-DE").trim();
    const score = Number(item?.score);
    if (word && Number.isInteger(score) && score >= 0 && score <= 100) {
      scoreByWord.set(word, score);
    }
  }
  const hints = candidates
    .filter(word => scoreByWord.has(word.toLocaleLowerCase("de-DE")))
    .map(word => ({
      word,
      similarity: scoreByWord.get(word.toLocaleLowerCase("de-DE")) / 100
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, requestedCount);
  if (!hints.length) throw new Error("Die Alltagsbewertung lieferte keine gültigen Tipp-Werte");
  return json({ hints, level, model: TEXT_MODEL, method: "everyday-relationship-judgement" });
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

    try {
      if (url.pathname === "/api/precomputed-rank") return await handlePrecomputedRank(env, body);
      if (url.pathname === "/api/admin/semantic-embeddings") return await handlePrecomputeSemanticEmbeddings(request, env, body);
      if (url.pathname === "/api/admin/embeddings") {
        if (!env?.AI) return json({ error: "Cloudflare Workers AI Binding 'AI' fehlt" }, 503);
        return await handlePrecomputeEmbeddings(request, env, body);
      }
      if (url.pathname === "/api/admin/rank") return await handlePrecomputeTarget(request, env, body);
      if (!env?.AI) return json({ error: "Cloudflare Workers AI Binding 'AI' fehlt" }, 503);
      switch (url.pathname) {
        case "/api/similarity": return await handleSimilarity(env, body);
        case "/api/similarity-semantic": return await handleSemanticSimilarity(env, body);
        case "/api/similarity-judgement": return await handleSemanticJudgement(env, body);
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
