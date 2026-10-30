// Holt die Events aus dem Google Sheet (als CSV veröffentlicht) und schreibt content/events.json.
// Bilder werden lokal gespeichert, damit Besucher:innen keine Verbindung zu Fremdservern aufbauen.
// Läuft täglich per GitHub Action (.github/workflows/events.yml). Keine Abhängigkeiten nötig (Node 20+).
import { writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { extname } from 'node:path';

const CSV_URL = process.env.SHEET_CSV_URL;
if (!CSV_URL) { console.error('SHEET_CSV_URL fehlt (GitHub → Settings → Secrets and variables → Actions).'); process.exit(1); }

// Nur Events, die direkt bei Lüneburg TICKETS buchbar sind:
const ERLAUBTE_HOSTS = ['lueneburgtickets.de', 'tickets.svg-lueneburg.de'];
const MAX = 24;
const BILD_ORDNER = 'src/assets/events';

// Spaltennamen im Sheet → Feld. Groß-/Kleinschreibung und Leerzeichen egal.
const ALIAS = {
  titel: ['titel', 'title', 'eventname', 'event', 'name', 'veranstaltung', 'bezeichnung'],
  ende: ['end', 'ende', 'enddatum', 'enddate', 'endzeit'],
  datum: ['datum', 'date', 'startdatum', 'start', 'beginn', 'startdate', 'eventdatum'],
  uhrzeit: ['uhrzeit', 'zeit', 'time', 'startzeit', 'beginnzeit', 'einlass'],
  ort: ['ort', 'location', 'venue', 'spielort', 'veranstaltungsort', 'locationname'],
  bild: ['bild', 'image', 'bildurl', 'imageurl', 'foto', 'eventbild', 'bildlink'],
  link: ['link', 'url', 'ticketlink', 'ticketurl', 'shoplink', 'eventurl', 'tickets'],
  anzeigen: ['anzeigen', 'website', 'gutscheinseite', 'aktiv', 'veröffentlichen']
};

function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const norm = (s) => s.toLowerCase().replace(/[\s_\-.]/g, '');

function datumIso(s) {
  s = (s || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}
function zeit(s, datumRoh) {
  let m = (s || '').match(/(\d{1,2})[:.](\d{2})/) || (datumRoh || '').match(/[ T](\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}
const slugify = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

const res = await fetch(CSV_URL, { redirect: 'follow' });
if (!res.ok) { console.error('CSV nicht abrufbar:', res.status); process.exit(1); }
const rows = parseCSV(await res.text());
const kopf = rows.shift().map(norm);
const idx = {};
for (const [feld, namen] of Object.entries(ALIAS)) idx[feld] = kopf.findIndex((k) => namen.map(norm).includes(k));
console.log('Gefundene Spalten:', Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, v >= 0 ? rows.length && kopf[v] : '—'])));
for (const pflicht of ['titel', 'datum', 'link']) if (idx[pflicht] < 0) { console.error(`Spalte für "${pflicht}" nicht gefunden. Kopfzeile: ${kopf.join(' | ')}`); process.exit(1); }

const heute = new Date(); heute.setHours(0, 0, 0, 0);
const get = (r, f) => (idx[f] >= 0 ? (r[idx[f]] || '').trim() : '');
let events = rows.map((r) => ({
  titel: get(r, 'titel'), datumRoh: get(r, 'datum'), endeRoh: get(r, 'ende'), datum: datumIso(get(r, 'datum')),
  uhrzeit: zeit(get(r, 'uhrzeit'), get(r, 'datum')), ort: get(r, 'ort'), bildUrl: get(r, 'bild'), link: get(r, 'link'), anzeigen: get(r, 'anzeigen')
}))
  .filter((e) => e.titel && e.datum && e.link && !/^(nein|no|false|0)$/i.test(e.anzeigen))
  .filter((e) => { try { const h = new URL(e.link).hostname.replace(/^www\./, ''); return ERLAUBTE_HOSTS.some((x) => h === x || h.endsWith('.' + x)); } catch { return false; } })
  .filter((e) => new Date(e.datum + 'T23:59:59') >= heute)
  .sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit));

// Doppelte (gleicher Link) entfernen
const gesehen = new Set(); events = events.filter((e) => !gesehen.has(e.link) && gesehen.add(e.link)).slice(0, MAX);

// Bilder lokal speichern
mkdirSync(BILD_ORDNER, { recursive: true });
const behalten = new Set();
for (const e of events) {
  e.bild = '';
  if (!/^https?:\/\//.test(e.bildUrl)) continue;
  try {
    const r = await fetch(e.bildUrl);
    if (!r.ok) continue;
    const typ = r.headers.get('content-type') || '';
    const ext = typ.includes('png') ? '.png' : typ.includes('webp') ? '.webp' : (extname(new URL(e.bildUrl).pathname) || '.jpg');
    const datei = `${e.datum}-${slugify(e.titel)}${ext}`;
    writeFileSync(`${BILD_ORDNER}/${datei}`, Buffer.from(await r.arrayBuffer()));
    e.bild = `/assets/events/${datei}`; behalten.add(datei);
  } catch { /* Bild optional */ }
}
// Alte Bilder aufräumen
if (existsSync(BILD_ORDNER)) for (const f of readdirSync(BILD_ORDNER)) if (!behalten.has(f) && f !== '.gitkeep') unlinkSync(`${BILD_ORDNER}/${f}`);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:?\d{2}|Z)$/;
const out = events.map(({ titel, datum, uhrzeit, ort, bild, link, datumRoh, endeRoh }) => ({
  titel, datum, uhrzeit, ort, bild, link,
  ...(ISO.test(datumRoh) ? { startIso: datumRoh } : {}),
  ...(ISO.test(endeRoh) ? { endeIso: endeRoh } : {})
}));
writeFileSync('content/events.json', JSON.stringify({ stand: new Date().toISOString(), events: out }, null, 2) + '\n');
console.log(`${out.length} Events geschrieben.`);
