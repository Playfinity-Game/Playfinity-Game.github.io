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
const profiles = [
  { name: 'Essen und Getränke', description: 'Lebensmittel, Zutaten, Speisen und Getränke.' },
  { name: 'Haushalt und Wohnen', description: 'Wohnräume, Möbel, Haushaltsgegenstände und Dinge des täglichen Wohnens.' },
  { name: 'Kleidung und Accessoires', description: 'Kleidung, Schuhe, Schmuck, Taschen und tragbare Accessoires.' },
  { name: 'Werkzeuge und Materialien', description: 'Werkzeuge, Geräte und Materialien zum Bearbeiten, Reparieren und Herstellen.' },
  { name: 'Technik und Elektronik', description: 'Elektronische Geräte, Computer, digitale Technik, Maschinen und technische Systeme.' },
  { name: 'Fahrzeuge und Verkehr', description: 'Fahrzeuge, Verkehrsmittel, Verkehrswege und Verkehrseinrichtungen.' },
  { name: 'Orte und Gebäude', description: 'Gebäude, Bauwerke, Räume und von Menschen geschaffene Orte.' },
  { name: 'Geografie und Landschaften', description: 'Länder, Regionen, Kontinente, Gewässer, Berge und natürliche Landschaften.' },
  { name: 'Wetter und Klima', description: 'Wetterlagen, Niederschlag, Temperatur, Klima und atmosphärische Erscheinungen.' },
  { name: 'Natur und Umwelt', description: 'Natur, Umwelt, Ökosysteme, natürliche Phänomene und Umweltschutz.' },
  { name: 'Weltraum und Himmelskörper', description: 'Sterne, Planeten, Monde, Galaxien, Astronomie und Raumfahrt.' },
  { name: 'Zeit und Jahreszeiten', description: 'Zeitangaben, Zeiträume, Kalender, Tageszeiten, Monate und Jahreszeiten.' },
  { name: 'Sport und Bewegung', description: 'Sportarten, Bewegung, Training, Wettkämpfe und sportliche Aktivitäten.' },
  { name: 'Kunst und Musik', description: 'Bildende Kunst, Musik, Instrumente, musikalische Werke und künstlerischer Ausdruck.' },
  { name: 'Film, Bücher und Medien', description: 'Filme, Bücher, Literatur, Fernsehen, Presse und digitale Medieninhalte.' },
  { name: 'Spiele und Freizeit', description: 'Spiele, Spielzeug, Hobbys, Unterhaltung und Freizeitbeschäftigungen.' },
  { name: 'Schule und Wissenschaft', description: 'Schule, Unterricht, Lernen, Forschung und wissenschaftliche Fachgebiete.' },
  { name: 'Sprache und Kommunikation', description: 'Sprache, Wörter, Schrift, Texte, Gespräche und Informationsaustausch.' },
  { name: 'Gesellschaft und Zusammenleben', description: 'Gemeinschaft, soziale Beziehungen, Institutionen, Politik und gesellschaftliches Leben.' },
  { name: 'Geschichte und Vergangenheit', description: 'Historische Epochen, Ereignisse, Personenrollen und Dinge aus der Vergangenheit.' },
  { name: 'Wirtschaft und Geld', description: 'Geld, Handel, Unternehmen, Märkte, Finanzen und wirtschaftliche Vorgänge.' },
  { name: 'Gefühle und Eigenschaften', description: 'Emotionen, Stimmungen, Charakterzüge, Eigenschaften und abstrakte Zustände.' },
  { name: 'Religion und Mythologie', description: 'Religionen, Glaubensvorstellungen, Gottheiten, Mythen und religiöse Gegenstände.' },
  { name: 'Fantasie und Fabelwesen', description: 'Fabelwesen, Zauberwesen, Märchenfiguren und erfundene fantastische Dinge.' },
  { name: 'Landwirtschaft und Garten', description: 'Landwirtschaft, Ackerbau, Nutztiere, Pflanzenanbau, Gartenarbeit und Gartengeräte.' },
  { name: 'Handwerk und Bauwesen', description: 'Handwerksberufe, Bauarbeiten, Bauteile, Baustellen und Bauverfahren.' }
];

env.allowLocalModels = false;
env.useBrowserCache = false;

const rawWords = JSON.parse(await fs.readFile(DICTIONARY, 'utf8'));
if (!Array.isArray(rawWords)) throw new Error('Die aktive Zielwortliste ist kein JSON-Array.');
const unique = new Map();
for (const value of rawWords) {
  const word = String(value).trim().normalize('NFC');
  if (!/^[A-Za-zÄÖÜäöüß-]{2,}$/.test(word)) continue;
  const key = word.toLocaleLowerCase('de-DE');
  if (!unique.has(key)) unique.set(key, word);
}
const words = [...unique.entries()];
if (words.length !== 8213) throw new Error(`Erwartet werden exakt 8.213 eindeutige Zielwörter, gefunden: ${words.length}`);

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
