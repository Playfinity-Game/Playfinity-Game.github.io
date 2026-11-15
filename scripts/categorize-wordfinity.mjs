import fs from 'node:fs/promises';
import { pipeline, env } from '@xenova/transformers';

const DICTIONARY = 'data/wordfinity-nouns.json';
const OUTPUT = 'data/wordfinity-categories.json';
const REVIEW = 'data/wordfinity-category-review.json';
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const BATCH_SIZE = 48;
const REVIEW_MARGIN = 0.025;
const REVIEW_SCORE = 0.30;

// Fester WORDFINITY-Katalog: exakt 26 vom Nutzer bestätigte Kategorien.
// Diese Liste ist die verbindliche Quelle für die automatische Sortierung.
// Datenbasis: exakt 8.213 geprüfte Zielwörter.
const categoryDescriptions = {
  "Tiere": "Tierarten, Säugetiere, Vögel, Fische, Insekten und andere Tiere.",
  "Pflanzen & Garten": "Pflanzen, Bäume, Blumen, Gartenpflanzen, Gartenarbeit und Gartenbedarf.",
  "Essen & Trinken": "Lebensmittel, Speisen, Zutaten und zubereitete Gerichte.",
  "Haushalt & Wohnen": "Haushaltsgegenstände, Möbel, Räume und Wohnen.",
  "Kleidung & Accessoires": "Kleidungsstücke, Schuhe, Taschen, Schmuck und tragbare Accessoires.",
  "Körper & Gesundheit": "Körperteile, Krankheiten, Symptome, Medizin und Gesundheit.",
  "Familie & Menschen": "Menschen, Familienmitglieder, Personen und soziale Beziehungen.",
  "Berufe & Arbeit": "Berufe, Tätigkeiten, Arbeitsplätze und Arbeitswelt.",
  "Schule & Bildung": "Schule, Unterricht, Lernen, Bildung und Lehrmaterial.",
  "Sport & Bewegung": "Sportarten, Sportgeräte, Training und körperliche Bewegung.",
  "Spiele & Freizeit": "Spiele, Spielzeug, Hobbys und Freizeitaktivitäten.",
  "Musik & Kunst": "Musik, Musikinstrumente, Kunstwerke und künstlerische Tätigkeiten.",
  "Film, Bücher & Medien": "Filme, Bücher, Literatur, Fernsehen und Medien.",
  "Technik & Elektronik": "Technische Geräte, Maschinen, Elektronik und technische Systeme.",
  "Werkzeuge & Material": "Werkzeuge, Werkstoffe, Baumaterialien und Hilfsmittel.",
  "Fahrzeuge & Verkehr": "Fahrzeuge, Verkehrsmittel, Verkehr und Transport.",
  "Gebäude & Orte": "Gebäude, Bauwerke, Einrichtungen und Orte.",
  "Natur & Landschaft": "Natur, Landschaften, Wälder, Berge und natürliche Umgebungen.",
  "Wetter & Klima": "Wetter, Niederschlag, Temperatur und Klimaerscheinungen.",
  "Weltraum & Wissenschaft": "Weltraum, Himmelskörper, Astronomie und wissenschaftliche Begriffe.",
  "Zeit & Kalender": "Zeitangaben, Kalender, Tageszeiten, Monate und Jahreszeiten.",
  "Geld & Wirtschaft": "Geld, Finanzen, Handel, Unternehmen und Wirtschaft.",
  "Gefühle & Eigenschaften": "Gefühle, Emotionen, Charakterzüge und abstrakte Eigenschaften.",
  "Fantasie & Märchen": "Fabelwesen, Märchenfiguren, Zauberei und fantastische Dinge.",
  "Religion & Feste": "Religionen, Glauben, religiöse Gegenstände und Feste.",
  "Geschichte & Gesellschaft": "Geschichte, Politik, Gesellschaft, Institutionen und historische Epochen.",
  "Reisen & Urlaub": "Reisen, Urlaub, Reiseziele und Reiseausrüstung.",
  "Obst & Gemüse": "Obst, Gemüse, essbare Pflanzen und Früchte.",
  "Getränke & Süßes": "Getränke, Süßigkeiten, Desserts und süße Speisen.",
  "Küche & Kochen": "Küchenutensilien, Kochgeräte und Tätigkeiten beim Kochen.",
  "Bauernhof & Landwirtschaft": "Landwirtschaft, Bauernhof, Nutztiere und Feldarbeit.",
  "Meer & Wasser": "Meere, Gewässer, Wasserlebewesen und Wasserlandschaften.",
  "Internet & Handy": "Internet, Smartphones, digitale Kommunikation und Online-Dienste.",
  "Restaurant & Café": "Restaurants, Cafés, Gastronomie und Restaurantbetrieb.",
  "Körperpflege & Bad": "Körperpflege, Hygiene, Kosmetik und Badezimmer.",
  "Polizei, Feuerwehr & Rettung": "Polizei, Feuerwehr, Rettungsdienste und Notfallausrüstung.",
  "Zirkus & Jahrmarkt": "Zirkus, Schausteller, Jahrmarkt und Fahrgeschäfte.",
  "Camping & Outdoor": "Camping, Wandern, Outdoor-Ausrüstung und Aktivitäten im Freien."
};
const profiles = Object.entries(categoryDescriptions).map(([name, description]) => ({ name, description }));

env.allowLocalModels = false;
env.useBrowserCache = false;

const rawWords = JSON.parse(await fs.readFile(DICTIONARY, 'utf8'));
if (!rawWords || Array.isArray(rawWords) || typeof rawWords !== 'object') {
  throw new Error('Die aktive Zielwortliste muss ein gruppiertes JSON-Objekt sein.');
}
const sourceCategories = Object.keys(rawWords);
if (sourceCategories.length !== 38) {
  throw new Error(`Erwartet werden 38 aktive Kategorien, gefunden: ${sourceCategories.length}`);
}
const unique = new Map();
for (const [category, values] of Object.entries(rawWords)) {
  if (!Array.isArray(values)) throw new Error(`Kategorie "${category}" enthält kein Wort-Array.`);
  for (const value of values) {
    const word = String(value).trim().normalize('NFC');
    if (!/^[A-Za-zÄÖÜäöüß-]{2,}$/.test(word)) continue;
    const key = word.toLocaleLowerCase('de-DE');
    if (!unique.has(key)) unique.set(key, word);
  }
}
const words = [...unique.entries()];
if (words.length === 0) throw new Error('Die aktive Wortliste ist leer.');
if (profiles.length !== sourceCategories.length || sourceCategories.some(name => !categoryDescriptions[name])) {
  throw new Error('Die Kategorien im Skript stimmen nicht mit der aktiven Wortliste überein.');
}

console.log(`Lade ${MODEL}; ${words.length} Wörter, ${profiles.length} Kategorien.`);
const extractor = await pipeline('feature-extraction', MODEL);
const profileOutput = await extractor(profiles.map(p => p.description), { pooling: 'mean', normalize: true });
const width = profileOutput.dims.at(-1);
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

await fs.writeFile(OUTPUT, JSON.stringify({ model: MODEL, profileCount: profiles.length, wordCount: words.length, categories }, null, 2) + '\n');
await fs.writeFile(REVIEW, JSON.stringify({ threshold: { margin: REVIEW_MARGIN, topScore: REVIEW_SCORE }, count: review.length, items: review }, null, 2) + '\n');
console.log(`Fertig: ${words.length} Wörter zugeordnet; ${review.length} Fälle zur manuellen Prüfung markiert.`);
